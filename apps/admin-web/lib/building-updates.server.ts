import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { demoSourceUpdate, demoUsers } from "@leaseflow/demo-data";
import { canPerform, registerDocumentAsset as validateDocumentAssetRegistration, type UserRole } from "@leaseflow/domain";
import { z } from "zod/v3";
import { DemoFileStore, RevisionConflictError, getDemoStore } from "./demo-store.server";
import { selectCurrentExternalOperations } from "./demo-workflow-public.server";
import { extractSyntheticSource } from "./source-extraction.server";
import { analyzeSourceDocument } from "./source-document-parser.server";

const UPDATE_REF = "cobalt-2026-07-18";
const BUILDING_NAME = demoSourceUpdate.buildingName;
const SOURCE_ORGANIZATION = "Synthetic Asset Management";

const portfolioBuildings = [
  { id: "bld-cobalt", name: "Cobalt Finance Center" },
  { id: "bld-pacific-gate", name: "Pacific Gate Tower" },
  { id: "bld-teheran-link", name: "Teheran Link" },
] as const;

const documentTypeSchema = z.enum([
  "monthly_owner_update",
  "floor_plan",
  "leasing_flyer",
  "area_workbook",
  "legal_document",
]);

const uploadedSourceSchema = z.object({
  building_id: z.literal("bld-cobalt"),
  effective_date: z.literal(demoSourceUpdate.effectiveDate),
  source_type: z.literal("monthly_owner_update"),
}).passthrough();

const portfolioBuildingIdSchema = z.enum(["bld-cobalt", "bld-pacific-gate", "bld-teheran-link"]);
const portfolioBuildingNameSchema = z.enum(["Cobalt Finance Center", "Pacific Gate Tower", "Teheran Link"]);

const uploadRegistrationSchema = z.object({
  building_id: portfolioBuildingIdSchema.optional(),
  building_name: portfolioBuildingNameSchema,
  document_type: documentTypeSchema,
}).strict().superRefine((value, context) => {
  const selected = portfolioBuildings.find((building) => building.name === value.building_name);
  if (!selected || (value.building_id !== undefined && value.building_id !== selected.id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "선택한 건물 정보를 다시 확인해 주세요." });
  }
});

const uploadedFileSchema = z.object({
  original_filename: z.string().min(1),
  stored_filename: z.string().min(1),
  mime_type: z.string().min(1),
  byte_size: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const reviewedCandidateSchema = z.object({
  summary: z.string().min(1).max(240),
  facts: z.array(z.object({
    label: z.string().min(1).max(40),
    value: z.string().min(1).max(120),
  }).strict()).max(6),
}).strict();

const candidateAnalysisRecordSchema = z.object({
  status: z.literal("candidate_ready"),
  candidate_count: z.number().int().nonnegative(),
  analyzed_at: z.string().datetime(),
  extraction_mode: z.enum(["live", "credential_free_demo"]).optional(),
  source_format: z.enum(["json", "pdf", "xlsx", "docx"]),
  normalized_text_length: z.number().int().nonnegative().max(200_000).optional(),
  table_count: z.number().int().nonnegative().optional(),
  page_count: z.number().int().positive().optional(),
  sheet_names: z.array(z.string().max(80)).max(10).optional(),
  warnings: z.array(z.string().max(160)).max(10).optional(),
  reviewed_candidate: reviewedCandidateSchema.optional(),
}).strict();

const manualReviewAnalysisRecordSchema = z.object({
  status: z.literal("manual_review"),
  code: z.enum(["UNSUPPORTED_DWG", "EXTRACTION_LIMIT"]),
  message: z.string().min(1),
  analyzed_at: z.string().datetime(),
  source_format: z.enum(["pdf", "dwg"]),
}).strict();

const analysisRecordSchema = z.discriminatedUnion("status", [candidateAnalysisRecordSchema, manualReviewAnalysisRecordSchema]);

const allowedDemoFiles = [{
  key: "july-building-update",
  filename: "source_update.json",
  label: "7월 건물정보 변경 자료",
  repositoryPath: "data/demo/source_update.json",
}] as const;

const registrationSchema = z.object({
  selected_file: z.literal(allowedDemoFiles[0].key),
  source_organization: z.literal(SOURCE_ORGANIZATION),
  effective_date: z.literal(demoSourceUpdate.effectiveDate),
  building_name: z.literal(BUILDING_NAME),
}).strict();

const intakeSchema = z.object({
  update_ref: z.literal(UPDATE_REF),
  selected_file: z.literal(allowedDemoFiles[0].key),
  source_organization: z.literal(SOURCE_ORGANIZATION),
  effective_date: z.literal(demoSourceUpdate.effectiveDate),
  building_name: portfolioBuildingNameSchema,
  registered_at: z.string().datetime(),
  building_id: portfolioBuildingIdSchema.optional(),
  document_type: documentTypeSchema.optional(),
  document_asset_id: z.string().min(1).optional(),
  uploaded_file: uploadedFileSchema.optional(),
  analysis: analysisRecordSchema.optional(),
}).strict();

export type BuildingUpdateRegistration = z.infer<typeof registrationSchema>;
export type BuildingUpdateUploadRegistration = z.infer<typeof uploadRegistrationSchema>;
type IntakeRecord = z.infer<typeof intakeSchema>;
type BuildingUpdateAction = "register" | "confirm" | "publish" | "review_document" | "publish_document";
type DocumentType = z.infer<typeof documentTypeSchema>;
type SourceFormat = "pdf" | "xlsx" | "docx" | "dwg";
type DocumentReviewPolicy = "publishable_reference" | "review_only" | "manual_review";
type DemoState = Awaited<ReturnType<DemoFileStore["getState"]>>;

type GovernedDocumentAsset = DemoState["asset_registry"]["assets"][number] & {
  document_type?: DocumentType;
  source_format?: SourceFormat | "json";
  source_origin?: "synthetic_seed" | "ephemeral_private_qa";
  review_policy?: DocumentReviewPolicy;
  reviewed_summary?: string | null;
};

const intakePathLocks = new Map<string, Promise<void>>();

async function withIntakePathLock<T>(storePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = intakePathLocks.get(storePath) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  intakePathLocks.set(storePath, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (intakePathLocks.get(storePath) === tail) intakePathLocks.delete(storePath);
  }
}

function repositoryRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
}

function defaultIntakePath() {
  const demoStatePath = process.env.LEASEFLOW_DEMO_STATE_PATH;
  const runtimeDirectory = demoStatePath
    ? path.dirname(path.resolve(demoStatePath))
    : path.join(repositoryRoot(), "data/demo/.runtime");
  return path.join(runtimeDirectory, "building-updates.v1.json");
}

export function parseBuildingUpdateRegistration(value: unknown): BuildingUpdateRegistration {
  return registrationSchema.parse(value);
}

export function parseBuildingUpdateUploadRegistration(value: unknown): BuildingUpdateUploadRegistration {
  return uploadRegistrationSchema.parse(value);
}

export function canAccessBuildingUpdates(role: UserRole) {
  return role === "data_steward" || role === "senior_reviewer" || role === "admin";
}

export function canRunBuildingUpdateAction(role: UserRole, action: BuildingUpdateAction) {
  if (action === "register") return canPerform(role, "source.upload");
  if (action === "confirm" || action === "review_document") return canPerform(role, "candidate.confirm");
  return canPerform(role, "record.publish");
}

export class BuildingUpdateIntakeStore {
  constructor(readonly storePath = defaultIntakePath()) {}

  async get(): Promise<IntakeRecord | null> {
    return withIntakePathLock(this.storePath, () => this.readUnlocked());
  }

  async save(record: IntakeRecord) {
    return withIntakePathLock(this.storePath, () => this.writeUnlocked(record));
  }

  async saveUploadedFile(bytes: Uint8Array, originalFilename: string, sha256: string) {
    const safeFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedFilename = `${sha256.slice(0, 12)}-${safeFilename || "source.json"}`;
    const uploadDirectory = path.join(path.dirname(this.storePath), "building-update-files");
    await mkdir(uploadDirectory, { recursive: true });
    const destination = path.join(uploadDirectory, storedFilename);
    await writeFile(destination, bytes);
    return storedFilename;
  }

  async readUploadedFile(storedFilename: string): Promise<Uint8Array> {
    if (path.basename(storedFilename) !== storedFilename) {
      throw new Error("등록된 원본 파일 경로가 올바르지 않습니다.");
    }
    return readFile(path.join(path.dirname(this.storePath), "building-update-files", storedFilename));
  }

  async clear() {
    return withIntakePathLock(this.storePath, () => this.clearUnlocked());
  }

  async snapshotForDemoReset(): Promise<IntakeRecord | null> {
    return withIntakePathLock(this.storePath, async () => structuredClone(await this.readUnlocked()));
  }

  async restoreAfterFailedDemoReset(snapshot: IntakeRecord | null): Promise<void> {
    return withIntakePathLock(this.storePath, async () => {
      if (snapshot === null) {
        await this.clearUnlocked();
        return;
      }
      await this.writeUnlocked(intakeSchema.parse(structuredClone(snapshot)));
    });
  }

  private async readUnlocked(): Promise<IntakeRecord | null> {
    try {
      return intakeSchema.parse(JSON.parse(await readFile(this.storePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async writeUnlocked(record: IntakeRecord): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(intakeSchema.parse(record), null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.storePath);
  }

  private async clearUnlocked(): Promise<void> {
    try {
      await unlink(this.storePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

function resolveActor(actorId: string) {
  const actor = demoUsers.find((user) => user.id === actorId);
  if (!actor) throw new Error("Unknown building-update actor.");
  return actor;
}

function requireAccess(actorId: string) {
  const actor = resolveActor(actorId);
  if (!canAccessBuildingUpdates(actor.role)) throw new Error("Building update access is not allowed.");
  return actor;
}

function requireAction(actorId: string, action: BuildingUpdateAction) {
  const actor = requireAccess(actorId);
  if (!canRunBuildingUpdateAction(actor.role, action)) throw new Error("Building update action is not allowed.");
  return actor;
}

function resolvePortfolioBuilding(registration: BuildingUpdateUploadRegistration) {
  const building = portfolioBuildings.find((candidate) => candidate.name === registration.building_name);
  if (!building || (registration.building_id !== undefined && registration.building_id !== building.id)) {
    throw new Error("Unknown portfolio building.");
  }
  return building;
}

function reviewPolicy(documentType: DocumentType, sourceFormat: SourceFormat, manualReview: boolean): DocumentReviewPolicy {
  if (manualReview || sourceFormat === "dwg") return "manual_review";
  if (documentType === "legal_document" || documentType === "area_workbook" || documentType === "floor_plan") {
    return "review_only";
  }
  return "publishable_reference";
}

function reviewedCandidate(
  buildingName: string,
  documentType: DocumentType,
  sourceFormat: Exclude<SourceFormat, "dwg">,
  analysis: Extract<Awaited<ReturnType<typeof analyzeSourceDocument>>, { status: "accepted" }>,
) {
  const documentLabels: Record<DocumentType, string> = {
    monthly_owner_update: "월간 임대 현황",
    floor_plan: "평면도",
    leasing_flyer: "임대 안내자료",
    area_workbook: "면적 관리표",
    legal_document: "계약·법무 자료",
  };
  const facts = [
    { label: "건물", value: buildingName },
    { label: "자료 종류", value: documentLabels[documentType] },
    { label: "파일 형식", value: sourceFormat.toUpperCase() },
  ];
  if (analysis.normalized.metadata.pageCount) {
    facts.push({ label: "확인 분량", value: `${analysis.normalized.metadata.pageCount}쪽` });
  }
  if (analysis.normalized.metadata.sheetNames) {
    facts.push({ label: "확인 시트", value: `${analysis.normalized.metadata.sheetNames.length}개` });
  }
  if (analysis.normalized.tables.length > 0) {
    facts.push({ label: "확인 표", value: `${analysis.normalized.tables.length}개` });
  }
  return reviewedCandidateSchema.parse({
    summary: `${buildingName}의 ${documentLabels[documentType]}를 검토용으로 준비했습니다. 담당자 확인 전에는 공식 건물정보에 반영되지 않습니다.`,
    facts,
  });
}

function sourceFormatForManualReview(filename: string): "pdf" | "dwg" {
  return path.extname(filename).toLowerCase() === ".pdf" ? "pdf" : "dwg";
}

function nonJsonSourceFormat(format: "json" | "pdf" | "xlsx" | "docx"): "pdf" | "xlsx" | "docx" {
  if (format === "json") throw new Error("Invalid reference-document format.");
  return format;
}

function projectDocumentAsset(asset: GovernedDocumentAsset | null) {
  if (!asset?.document_type || !asset.source_format || !asset.source_origin || !asset.review_policy) return null;
  return {
    id: asset.id,
    building_id: asset.building_id,
    document_type: asset.document_type,
    source_format: asset.source_format,
    source_origin: asset.source_origin,
    status: asset.status,
    review_policy: asset.review_policy,
    reviewed_summary: asset.reviewed_summary ?? null,
    externally_shareable: asset.externally_shareable,
    active: asset.active,
    authorized: asset.authorized,
  };
}

function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    marketed_area_py: "전용면적",
    floor_plan: "도면",
    rent_free_months: "렌트프리",
    supported_parking_spaces: "지원 주차",
  };
  return labels[field] ?? "건물정보";
}

function displayValue(field: string, value: unknown) {
  if (field === "marketed_area_py") return `${String(value)}평`;
  if (field === "rent_free_months") return `${String(value)}개월`;
  if (field === "supported_parking_spaces") return `${String(value)}대`;
  return String(value);
}

function stepFor(stage: string, hasIntake: boolean) {
  if (stage === "source_uploaded") return "자료 올리기" as const;
  if (stage === "published") return "최신정보 반영" as const;
  if (stage === "junior_confirmed" || stage === "senior_approved") return "최종 확인" as const;
  if (stage === "extracted_candidate") return "변경 확인" as const;
  return hasIntake ? "변경 확인" as const : "자료 올리기" as const;
}

function stepForDocument(asset: GovernedDocumentAsset) {
  if (asset.status === "published") return "최신정보 반영" as const;
  if (asset.review_policy === "manual_review") return "최종 확인" as const;
  if (asset.status === "registered") return "담당자 확인" as const;
  return "최종 확인" as const;
}

export class BuildingUpdateService {
  constructor(
    readonly workflowStore: DemoFileStore = getDemoStore(),
    readonly intakeStore = new BuildingUpdateIntakeStore(),
  ) {}

  async projection(actorId: string, now = new Date()) {
    const actor = requireAccess(actorId);
    const [state, intake] = await Promise.all([this.workflowStore.getState(), this.intakeStore.get()]);
    const current = selectCurrentExternalOperations(state, now);
    const documentAsset = (intake?.document_asset_id
      ? state.asset_registry.assets.find((asset) => asset.id === intake.document_asset_id)
      : null) as GovernedDocumentAsset | null | undefined;
    const hasDocumentIntake = Boolean(intake?.document_asset_id);
    const documentStatus = documentAsset?.status as string | undefined;
    const allowedActions: BuildingUpdateAction[] = [];
    if (!hasDocumentIntake) {
      if (state.stage === "source_uploaded" && canRunBuildingUpdateAction(actor.role, "register")) allowedActions.push("register");
      if (state.stage === "extracted_candidate" && canRunBuildingUpdateAction(actor.role, "confirm")) allowedActions.push("confirm");
      if (state.stage === "junior_confirmed" && canRunBuildingUpdateAction(actor.role, "publish")) allowedActions.push("publish");
    }
    if (documentStatus === "registered" && documentAsset?.review_policy !== "manual_review"
      && canRunBuildingUpdateAction(actor.role, "review_document")) {
      allowedActions.push("review_document");
    }
    if ((documentStatus === "reviewed" || documentStatus === "steward_confirmed")
      && documentAsset?.review_policy === "publishable_reference"
      && documentAsset.reviewed_summary
      && canRunBuildingUpdateAction(actor.role, "publish_document")) {
      allowedActions.push("publish_document");
    }

    return {
      version: state.revision,
      updateRef: UPDATE_REF,
      buildingName: intake?.building_name ?? BUILDING_NAME,
      effectiveDate: demoSourceUpdate.effectiveDate,
      sourceOrganization: intake?.source_organization ?? SOURCE_ORGANIZATION,
      selectedFile: ((file) => ({ key: file.key, filename: file.filename, label: file.label }))(
        allowedDemoFiles.find((file) => file.key === intake?.selected_file) ?? allowedDemoFiles[0],
      ),
      availableFiles: allowedDemoFiles.map(({ repositoryPath: _repositoryPath, ...file }) => file),
      availableBuildings: portfolioBuildings.map((building) => ({ ...building })),
      documentTypes: [
        { value: "monthly_owner_update", label: "월간 임대 현황", accept: ".json,.pdf,.docx" },
        { value: "floor_plan", label: "평면도", accept: ".json,.pdf,.dwg" },
        { value: "leasing_flyer", label: "임대 안내자료", accept: ".json,.pdf,.docx" },
        { value: "area_workbook", label: "면적 관리표", accept: ".json,.xlsx" },
        { value: "legal_document", label: "계약·법무 자료", accept: ".json,.pdf,.docx" },
      ],
      documentType: intake?.document_type ?? "monthly_owner_update",
      uploadedFile: intake?.uploaded_file ?? null,
      analysis: intake?.analysis ?? null,
      documentAsset: projectDocumentAsset(documentAsset ?? null),
      step: documentAsset ? stepForDocument(documentAsset) : stepFor(state.stage, intake !== null),
      canStartNewUpload: state.stage === "published" && canRunBuildingUpdateAction(actor.role, "register"),
      allowedActions,
      changes: state.candidates.map((candidate) => ({
        label: fieldLabel(candidate.field),
        before: displayValue(candidate.field, candidate.previous_value),
        after: displayValue(candidate.field, candidate.proposed_value),
      })),
      currentFacts: current.records.map((record) => ({
        label: fieldLabel(record.field),
        value: displayValue(record.field, record.value),
        from: record.valid_from,
      })),
      currentFiles: current.files.map((file) => ({ filename: file.filename, from: file.valid_from })),
      history: state.records.filter((record) => record.status === "published" || record.status === "superseded")
        .sort((left, right) => right.version_no - left.version_no).map((record) => ({
        buildingName: BUILDING_NAME,
        label: fieldLabel(record.field),
        value: displayValue(record.field, record.value),
        updatedAt: record.valid_from,
        from: record.valid_from,
        to: record.valid_to,
        current: record.status === "published" && !record.superseded,
      })),
      users: demoUsers.map((user) => ({ id: user.id, displayName: user.display_name })),
    };
  }

  async register(actorId: string, expectedVersion: number, value: unknown, occurredAt = new Date().toISOString()) {
    requireAction(actorId, "register");
    const registration = parseBuildingUpdateRegistration(value);
    const state = await this.workflowStore.getState();
    if (state.revision !== expectedVersion) throw new RevisionConflictError(expectedVersion, state.revision);
    const extraction = await extractSyntheticSource();
    await this.intakeStore.save({ update_ref: UPDATE_REF, ...registration, registered_at: occurredAt });
    return this.workflowStore.extract(
      { actor_id: actorId, expected_revision: expectedVersion, occurred_at: occurredAt },
      extraction.candidates,
    );
  }

  async registerUpload(
    actorId: string,
    expectedVersion: number,
    value: unknown,
    file: { bytes: Uint8Array; filename: string; mimeType: string },
    occurredAt = new Date().toISOString(),
  ) {
    const actor = requireAction(actorId, "register");
    const registration = parseBuildingUpdateUploadRegistration(value);
    const state = await this.workflowStore.getState();
    if (state.revision !== expectedVersion) throw new RevisionConflictError(expectedVersion, state.revision);
    const analysis = await analyzeSourceDocument({ ...file, documentType: registration.document_type });

    if (analysis.status === "manual_review" || analysis.format !== "json") {
      if (registration.building_id === undefined) throw new Error("Unknown portfolio building.");
      const building = resolvePortfolioBuilding(registration);
      const sourceFormat = analysis.status === "manual_review"
        ? sourceFormatForManualReview(file.filename)
        : nonJsonSourceFormat(analysis.format);
      const policy = reviewPolicy(registration.document_type, sourceFormat, analysis.status === "manual_review");
      const candidate = analysis.status === "accepted"
        ? reviewedCandidate(building.name, registration.document_type, nonJsonSourceFormat(analysis.format), analysis)
        : null;
      const sha256 = createHash("sha256").update(file.bytes).digest("hex");
      const contentFingerprint = `sha256:${sha256}`;
      const existingDocumentAsset = state.asset_registry.assets.find((asset) =>
        asset.content_fingerprint === contentFingerprint);
      const documentAssetId = existingDocumentAsset?.id ?? `doc-${randomUUID()}`;
      const documentRegistration = {
        id: documentAssetId,
        observed_filename: path.basename(file.filename),
        content_fingerprint: contentFingerprint,
        mime_type: file.mimeType || "application/octet-stream",
        byte_size: file.bytes.byteLength,
        building_alias_candidate: building.name,
        building_id: building.id,
        source_organization: SOURCE_ORGANIZATION,
        document_type: registration.document_type,
        source_format: sourceFormat,
        source_origin: "ephemeral_private_qa" as const,
        has_extractable_text: analysis.status === "accepted",
        review_policy: policy,
        reviewed_summary: null,
      };
      validateDocumentAssetRegistration(state.asset_registry, {
        ...documentRegistration,
        actor,
        occurred_at: occurredAt,
      });
      const storedFilename = await this.intakeStore.saveUploadedFile(file.bytes, file.filename, sha256);
      await this.intakeStore.save({
        update_ref: UPDATE_REF,
        selected_file: allowedDemoFiles[0].key,
        source_organization: SOURCE_ORGANIZATION,
        effective_date: demoSourceUpdate.effectiveDate,
        building_id: building.id,
        building_name: building.name,
        registered_at: occurredAt,
        document_type: registration.document_type,
        document_asset_id: documentAssetId,
        uploaded_file: {
          original_filename: path.basename(file.filename), stored_filename: storedFilename,
          mime_type: file.mimeType || "application/octet-stream", byte_size: file.bytes.byteLength, sha256,
        },
        analysis: analysis.status === "manual_review" ? {
          ...analysis,
          analyzed_at: occurredAt,
          source_format: sourceFormatForManualReview(file.filename),
        } : {
          status: "candidate_ready", candidate_count: 0, analyzed_at: occurredAt, source_format: analysis.format,
          normalized_text_length: analysis.normalized.text.length, table_count: analysis.normalized.tables.length,
          ...(analysis.normalized.metadata.pageCount ? { page_count: analysis.normalized.metadata.pageCount } : {}),
          ...(analysis.normalized.metadata.sheetNames ? {
            sheet_names: analysis.normalized.metadata.sheetNames.slice(0, 10).map((name) => name.slice(0, 80)),
          } : {}),
          warnings: analysis.warnings.slice(0, 10).map((warning) => warning.slice(0, 160)),
          reviewed_candidate: candidate ?? undefined,
        },
      });
      return this.workflowStore.registerDocumentAsset({
        actor_id: actorId,
        expected_revision: expectedVersion,
        ...documentRegistration,
        occurred_at: occurredAt,
      });
    }

    let source: unknown;
    try {
      source = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.bytes)) as unknown;
    } catch {
      throw new Error("Invalid building-update source content.");
    }
    const sourceIdentity = uploadedSourceSchema.parse(source);
    if (registration.document_type !== sourceIdentity.source_type) throw new Error("Mismatched building-update document type.");
    if (resolvePortfolioBuilding(registration).id !== sourceIdentity.building_id) {
      throw new Error("Mismatched building-update source building.");
    }

    const extraction = await extractSyntheticSource({ loadSource: async () => source });
    const sha256 = createHash("sha256").update(file.bytes).digest("hex");
    const storedFilename = await this.intakeStore.saveUploadedFile(file.bytes, file.filename, sha256);
    await this.intakeStore.save({
      update_ref: UPDATE_REF,
      selected_file: allowedDemoFiles[0].key,
      source_organization: SOURCE_ORGANIZATION,
      effective_date: sourceIdentity.effective_date,
      building_name: registration.building_name,
      registered_at: occurredAt,
      document_type: registration.document_type,
      uploaded_file: {
        original_filename: path.basename(file.filename),
        stored_filename: storedFilename,
        mime_type: file.mimeType || "application/json",
        byte_size: file.bytes.byteLength,
        sha256,
      },
      analysis: {
        status: "candidate_ready",
        candidate_count: extraction.candidates.changes.length,
        analyzed_at: occurredAt,
        extraction_mode: extraction.mode,
        source_format: "json",
      },
    });
    return this.workflowStore.extract(
      { actor_id: actorId, expected_revision: expectedVersion, occurred_at: occurredAt },
      extraction.candidates,
    );
  }

  async confirm(actorId: string, expectedVersion: number, occurredAt = new Date().toISOString()) {
    requireAction(actorId, "confirm");
    return this.workflowStore.confirm({ actor_id: actorId, expected_revision: expectedVersion, occurred_at: occurredAt });
  }

  async publish(actorId: string, expectedVersion: number, occurredAt = new Date().toISOString()) {
    requireAction(actorId, "publish");
    return this.workflowStore.publish({ actor_id: actorId, expected_revision: expectedVersion, occurred_at: occurredAt });
  }

  async reviewDocument(
    actorId: string,
    expectedVersion: number,
    documentId: string,
    reviewedSummary: string,
    occurredAt = new Date().toISOString(),
  ) {
    requireAction(actorId, "review_document");
    const [state, intake] = await Promise.all([this.workflowStore.getState(), this.intakeStore.get()]);
    if (state.revision !== expectedVersion) throw new RevisionConflictError(expectedVersion, state.revision);
    if (!intake?.document_asset_id || intake.document_asset_id !== documentId) {
      throw new Error("Unknown current document.");
    }
    const asset = state.asset_registry.assets.find((candidate) => candidate.id === intake.document_asset_id) as GovernedDocumentAsset | undefined;
    if (!asset?.review_policy || asset.review_policy === "manual_review") {
      throw new Error("This document requires manual review and cannot enter the publication workflow.");
    }
    return this.workflowStore.reviewDocumentAsset({
      actor_id: actorId,
      expected_revision: expectedVersion,
      asset_id: asset.id,
      reviewed_summary: reviewedSummary,
      externally_shareable: asset.review_policy === "publishable_reference",
      occurred_at: occurredAt,
    });
  }

  async publishDocument(
    actorId: string,
    expectedVersion: number,
    documentId: string,
    occurredAt = new Date().toISOString(),
  ) {
    requireAction(actorId, "publish_document");
    const [state, intake] = await Promise.all([this.workflowStore.getState(), this.intakeStore.get()]);
    if (state.revision !== expectedVersion) throw new RevisionConflictError(expectedVersion, state.revision);
    if (!intake?.document_asset_id || intake.document_asset_id !== documentId) {
      throw new Error("Unknown current document.");
    }
    const asset = state.asset_registry.assets.find((candidate) => candidate.id === intake.document_asset_id) as GovernedDocumentAsset | undefined;
    if (asset?.review_policy !== "publishable_reference") {
      throw new Error("This document is review-only and cannot be published externally.");
    }
    return this.workflowStore.publishDocumentAsset({
      actor_id: actorId,
      expected_revision: expectedVersion,
      asset_id: asset.id,
      occurred_at: occurredAt,
    });
  }
}

let service: BuildingUpdateService | undefined;
export function getBuildingUpdateService() {
  service ??= new BuildingUpdateService();
  return service;
}
