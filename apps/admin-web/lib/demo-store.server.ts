import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { SourceCandidateSchema } from "@leaseflow/ai";
import {
  approveOperationalPackage,
  approveWeeklyReport,
  assertOperationalPackageContentIntegrity,
  assertGovernedPublicationStateInvariants,
  assertWeeklyReportIntegrity,
  confirmCandidates,
  confirmSourceAsset,
  confirmOperationalRequest,
  createInitialWeeklyReportState,
  createWeeklyReportDraft,
  decidePackageEdit,
  decideWeeklyReportPatch,
  draftOperationalPackage,
  importOperationalRequest,
  markWeeklyReportStale,
  proposePackageEdit,
  proposeWeeklyReportPatch,
  publishConfirmedBatch,
  publishDocumentAsset as publishGovernedDocumentAsset,
  publishSourceAsset,
  registerDocumentAsset as registerGovernedDocumentAsset,
  recordExtraction,
  reviewDocumentAsset as reviewGovernedDocumentAsset,
  sendWeeklyReport,
  sendOperationalPackage,
  type CreateWeeklyReportDraftInput,
  type GovernedAssetRegistry,
  type OperationalState,
  type OperationalRequestExtraction,
  type UserRole,
  type RegisterDocumentAssetInput,
  type WeeklyReportPatchCandidate,
  type WeeklyReportSections,
  type WeeklyReportState,
} from "@leaseflow/domain";
import {
  createDemoDraftMaterial,
  createInitialDemoState,
  currentDemoMaterialVersionIds,
  demoUsers,
  mapSourceCandidatesToDomain,
  migrateGovernedAssetRegistryToDocumentLifecycle,
  migrateDemoStateToV3,
  type DemoState,
  type LegacyDemoStateV2,
} from "@leaseflow/demo-data";
import { z } from "zod/v3";
import { loadCanonicalWeeklyReportDraft } from "./mock-outlook.server";
import {
  loadWeeklyReportAuthorities,
  type ConfiguredWeeklyReportAuthority,
} from "./weekly-settings.server";

export class RevisionConflictError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`Revision conflict: expected ${expected}, current revision is ${actual}.`);
  }
}

export class DemoStateCorruptError extends Error {
  constructor(message: string) {
    super(`Demo state is corrupt; refusing to continue: ${message}`);
  }
}

export class WeeklyReportStaleError extends Error {
  constructor(readonly currentRevision: number) {
    super(`Weekly report inputs became stale; reload revision ${currentRevision} before continuing.`);
  }
}

export class WorkflowAccessError extends Error {}

export function applyConfiguredWeeklyReportSections(
  sections: WeeklyReportSections,
  requiredSectionKeys: ConfiguredWeeklyReportAuthority["automation"]["required_section_keys"],
): WeeklyReportSections {
  const included = new Set<keyof WeeklyReportSections>(requiredSectionKeys);
  return {
    key_issue: included.has("key_issue") ? sections.key_issue : "",
    changes_since_last_report: included.has("changes_since_last_report") ? [...sections.changes_since_last_report] : [],
    activity_summary: included.has("activity_summary") ? [...sections.activity_summary] : [],
    negotiated_area_floor_changes: included.has("negotiated_area_floor_changes") ? [...sections.negotiated_area_floor_changes] : [],
    competitor_buildings: included.has("competitor_buildings") ? [...sections.competitor_buildings] : [],
    blocker_and_pending_approval: included.has("blocker_and_pending_approval") ? [...sections.blocker_and_pending_approval] : [],
    next_actions: included.has("next_actions") ? sections.next_actions.map((item) => ({ ...item })) : [],
  };
}

function defaultStorePath(): string {
  const cwd = process.cwd();
  const root = path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
  return path.join(root, "data/demo/.runtime/state.v1.json");
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const buildingAccessConfigSchema = z.object({
  configuration_id: z.string().min(1),
  users: z.array(z.object({ user_id: z.string().min(1), building_ids: z.array(z.string().min(1)).min(1) }).strict()),
}).strict();
const recipientConfigSchema = z.object({
  id: z.string().min(1), building_id: z.string().min(1), purpose: z.literal("broker_package"),
  recipient_name: z.string().min(1), recipient_organization: z.string().min(1),
  to: z.array(z.string().email()).min(1), cc: z.array(z.string().email()),
}).strict();
export interface DemoRuntimeConfiguration {
  access: z.infer<typeof buildingAccessConfigSchema>;
  recipients: z.infer<typeof recipientConfigSchema>;
  reportAuthorities?: ConfiguredWeeklyReportAuthority[];
  reportRecipients?: ConfiguredReportRecipientGroup;
}

export interface ConfiguredReportRecipientGroup {
  configuration_id: string;
  building_id: string;
  to: Array<{ email: string; role: string }>;
  cc: Array<{ email: string; role: string }>;
}

export async function loadDemoRuntimeConfiguration(): Promise<DemoRuntimeConfiguration> {
  const dataDirectory = path.dirname(path.dirname(defaultStorePath()));
  const [accessRaw, recipientsRaw, reportAuthorities] = await Promise.all([
    readFile(path.join(dataDirectory, "building_access.json"), "utf8"),
    readFile(path.join(dataDirectory, "broker_package_recipient_group.json"), "utf8"),
    loadWeeklyReportAuthorities(),
  ]);
  const primaryReportAuthority = reportAuthorities.find((authority) => authority.building_id === "bld-cobalt");
  return {
    access: buildingAccessConfigSchema.parse(JSON.parse(accessRaw)),
    recipients: recipientConfigSchema.parse(JSON.parse(recipientsRaw)),
    reportAuthorities,
    ...(primaryReportAuthority ? { reportRecipients: {
      configuration_id: primaryReportAuthority.configuration_id,
      building_id: primaryReportAuthority.building_id,
      to: primaryReportAuthority.recipients.to.map(({ email, role }) => ({ email, role })),
      cc: primaryReportAuthority.recipients.cc.map(({ email, role }) => ({ email, role })),
    } } : {}),
  };
}
const publicationStatusSchema = z.enum([
  "candidate", "junior_confirmed", "senior_approved", "published", "superseded", "rejected",
]);
const userRoleSchema = z.enum([
  "data_steward", "senior_reviewer", "lm_manager", "lm_member", "team_lead", "admin",
]);
const persistedValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const candidateSchema = z.object({
  id: z.string().min(1),
  building_id: z.string().min(1),
  field: z.enum(["marketed_area_py", "floor_plan", "rent_free_months", "supported_parking_spaces"]),
  floor: z.string().min(1),
  target_type: z.enum(["record", "file"]),
  predecessor_version_id: z.string().min(1),
  candidate_version_id: z.string().min(1),
  previous_value: persistedValueSchema,
  proposed_value: persistedValueSchema,
  source_state: z.enum(["confirmed", "under_discussion", "unverified"]),
  source_pointer: z.string().min(1),
  confidence: z.number().min(0).max(1),
  external_shareable_candidate: z.boolean(),
  status: z.enum(["candidate", "junior_confirmed", "published"]),
}).strict();
const recordSchema = z.object({
  id: z.string().min(1),
  building_id: z.string().min(1),
  kind: z.enum(["availability", "term"]),
  floor: z.string().min(1),
  field: z.enum(["marketed_area_py", "rent_free_months", "supported_parking_spaces"]),
  value: z.number(),
  version_no: z.number().int().positive(),
  status: publicationStatusSchema,
  valid_from: dateSchema,
  valid_to: dateSchema.nullable(),
  superseded: z.boolean(),
  external_shareable: z.boolean(),
}).strict();
const fileSchema = z.object({
  id: z.string().min(1),
  building_id: z.string().min(1),
  floor: z.string().min(1),
  filename: z.string().min(1),
  file_type: z.literal("floor_plan"),
  version_no: z.number().int().positive(),
  status: publicationStatusSchema,
  valid_from: dateSchema,
  valid_to: dateSchema.nullable(),
  superseded: z.boolean(),
  external_shareable: z.boolean(),
}).strict();
const auditSchema = z.object({
  id: z.string().min(1),
  event_type: z.enum([
    "source.extracted", "candidate.confirmed", "batch.senior_approved", "batch.published", "demo.reset",
  ]),
  actor_id: z.string().min(1),
  actor_role: userRoleSchema,
  entity_type: z.enum(["source", "candidate_batch", "publication_batch", "demo"]),
  entity_id: z.string().min(1),
  occurred_at: z.string().datetime(),
  metadata: z.record(z.unknown()),
}).strict();
const requestExtractionSchema = z.object({
  language: z.enum(["ko", "en", "mixed"]),
  building_mentions: z.array(z.object({ text: z.string(), resolved_building_id: z.string().nullable(), confidence: z.number().min(0).max(1) }).strict()),
  floor: z.string().nullable(),
  requested_fields: z.array(z.enum(["marketed_area", "rent_free", "supported_parking"])),
  requested_files: z.array(z.enum(["current_floor_plan"])),
  recipient: z.object({ name: z.string().nullable(), organization: z.string().nullable() }).strict(),
  deadline: z.string().nullable(),
  ambiguities: z.array(z.object({ field: z.string(), reason: z.string() }).strict()),
}).strict();
const packageFactSchema = z.object({
  field: z.enum(["marketed_area", "rent_free", "supported_parking"]), label: z.string(), value: z.number(),
  unit: z.enum(["py", "months", "spaces"]), version_id: z.string(), source_pointer: z.string(),
}).strict();
const packageFileSchema = z.object({ requested_file: z.literal("current_floor_plan"), filename: z.string(), version_id: z.string(), source_pointer: z.string() }).strict();
const reportPeriodSchema = z.object({ from: dateSchema, to: dateSchema }).strict();
const reportNextActionSchema = z.object({
  action: z.string().min(1), owner: z.string().min(1), due_date: dateSchema,
}).strict();
const reportSectionsSchema = z.object({
  key_issue: z.string(),
  changes_since_last_report: z.array(z.string()),
  activity_summary: z.array(z.string()),
  negotiated_area_floor_changes: z.array(z.string()),
  competitor_buildings: z.array(z.string()),
  blocker_and_pending_approval: z.array(z.string()),
  next_actions: z.array(reportNextActionSchema),
}).strict();
const reportSourceSchema = z.object({
  id: z.string().min(1), source_type: z.string().min(1), building_id: z.string().min(1),
  occurred_at: z.string().datetime({ offset: true }), share_scope: z.literal("external_reportable"),
  summary: z.string().min(1),
}).strict();
const reportAttachmentSchema = z.object({
  id: z.string().min(1), building_id: z.string().min(1), version_id: z.string().min(1), filename: z.string().min(1),
}).strict();
const reportRecipientsSchema = z.object({
  configuration_id: z.string().min(1),
  to: z.array(z.object({ email: z.string().email(), role: z.string().min(1) }).strict()).min(1),
  cc: z.array(z.object({ email: z.string().email(), role: z.string().min(1) }).strict()).min(1),
}).strict();
const reportCoverSchema = z.object({ subject: z.string().min(1), body: z.string().min(1) }).strict();
const reportValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.array(reportNextActionSchema),
]);
const reportPatchCandidateSchema = z.object({
  id: z.string().min(1),
  command: z.enum([
    "통화내용 확인해서 이번주 변동사항 업데이트 해",
    "이메일 확인해서 이번주 변동사항 업데이트 해",
    "협의 중인 면적 변동 있는지 확인해",
    "협의 중인 층 변동 있는지 확인해",
    "메일이랑 전화 확인해서 경쟁빌딩 파악해봐",
  ]),
  target_building_ids: z.array(z.string().min(1)).length(1),
  findings: z.array(z.object({
    category: z.string().min(1), finding: z.string().min(1),
    source_reference_ids: z.array(z.string().min(1)).min(1), confidence: z.number().finite().min(0).max(1),
  }).strict()).min(1),
  operations: z.array(z.object({
    section: z.enum([
      "key_issue", "changes_since_last_report", "activity_summary", "negotiated_area_floor_changes",
      "competitor_buildings", "blocker_and_pending_approval", "next_actions",
    ]),
    operation: z.enum(["replace", "append", "remove", "reorder"]),
    before: reportValueSchema, after: reportValueSchema,
    source_reference_ids: z.array(z.string().min(1)).min(1),
  }).strict()).min(1),
  unresolved: z.array(z.object({ field: z.string().min(1), question: z.string().min(1) }).strict()),
}).strict();
const reportProtectedSnapshotSchema = z.object({
  building_id: z.string().min(1), reporting_period: reportPeriodSchema,
  recipients: reportRecipientsSchema, sources: z.array(reportSourceSchema).min(1),
  attachments: z.array(reportAttachmentSchema), current_material_ids: z.array(z.string().min(1)).min(1),
  cover: reportCoverSchema,
}).strict();
const weeklyReportSchema = z.object({
  id: z.string().min(1), building_id: z.string().min(1), reporting_period: reportPeriodSchema,
  status: z.enum(["draft", "patch_pending", "approved", "sent", "stale"]),
  base_sections: reportSectionsSchema, current_sections: reportSectionsSchema,
  pending_candidate: reportPatchCandidateSchema.nullable(),
  accepted_patch_history: z.array(z.object({
    candidate: reportPatchCandidateSchema, accepted_by: z.string().min(1), accepted_at: z.string().datetime(),
  }).strict()),
  sources: z.array(reportSourceSchema).min(1), attachments: z.array(reportAttachmentSchema),
  current_material_ids: z.array(z.string().min(1)).min(1), recipients: reportRecipientsSchema,
  cover: reportCoverSchema, unresolved: z.array(z.string()),
  approval: z.object({ approved_by: z.string().min(1).nullable(), approved_at: z.string().datetime().nullable() }).strict(),
  delivery: z.object({ sent_at: z.string().datetime().nullable(), idempotency_key: z.string().min(1).nullable() }).strict(),
  protected_snapshot: reportProtectedSnapshotSchema,
}).strict();
const weeklyReportStateSchema = z.object({
  reports: z.array(weeklyReportSchema),
  activities: z.array(z.object({
    id: z.string().min(1), event_type: z.literal("report.sent.sandbox"), report_id: z.string().min(1),
    building_id: z.string().min(1), occurred_at: z.string().datetime(), summary: z.string().min(1),
  }).strict()),
  audit: z.array(z.object({
    id: z.string().min(1),
    event_type: z.enum(["report.drafted", "report.patch_proposed", "report.patch_accepted", "report.patch_rejected", "report.approved", "report.sent.sandbox", "report.marked_stale"]),
    actor_id: z.string().min(1), actor_role: userRoleSchema, report_id: z.string().min(1),
    occurred_at: z.string().datetime(), metadata: z.record(z.unknown()),
  }).strict()),
}).strict();
const operationalStateSchema = z.object({
  requests: z.array(z.object({
    id: z.string(), source: z.enum(["call", "email"]), source_id: z.string(), raw_text: z.string(), extraction: requestExtractionSchema,
    status: z.enum(["candidate", "confirmed"]), imported_at: z.string().datetime(), confirmed_at: z.string().datetime().nullable(),
  }).strict()),
  packages: z.array(z.object({
    id: z.string(), request_id: z.string(), building_id: z.string(), floor: z.string(),
    status: z.enum(["draft", "edit_pending", "approved", "sent", "stale"]), subject: z.string(), body: z.string(),
    facts: z.array(packageFactSchema), files: z.array(packageFileSchema),
    recipients: z.object({ to: z.array(z.string().email()), cc: z.array(z.string().email()), configuration_id: z.string() }).strict(),
    unresolved: z.array(z.string()),
    edit_candidate: z.object({ subject: z.string(), body: z.string(), instruction: z.string() }).strict().nullable(),
    approved_by: z.string().nullable(), approved_at: z.string().datetime().nullable(), sent_at: z.string().datetime().nullable(), idempotency_key: z.string().nullable(),
  }).strict()),
  activities: z.array(z.object({
    id: z.string(), event_type: z.literal("package.sent.sandbox"), package_id: z.string(), building_id: z.string(), occurred_at: z.string().datetime(), summary: z.string(),
  }).strict()),
  audit: z.array(z.object({
    id: z.string(), event_type: z.enum(["request.imported", "request.confirmed", "package.drafted", "package.edit_proposed", "package.edit_accepted", "package.edit_rejected", "package.approved", "package.sent.sandbox"]),
    actor_id: z.string(), actor_role: userRoleSchema, entity_id: z.string(), occurred_at: z.string().datetime(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }).strict()),
  reports: weeklyReportStateSchema,
}).strict();
const assetAuditProvenanceSchema = z.object({
  event: z.enum(["registered", "filename_observed", "classified", "steward_confirmed", "reviewed", "published", "superseded"]),
  actor_id: z.string().min(1), occurred_at: z.string().datetime(), details: z.record(z.unknown()),
}).strict();
const sourceAssetSchema = z.object({
  id: z.string().min(1), observed_filenames: z.array(z.string().min(1)).min(1),
  synthetic_fingerprint: z.string().startsWith("synthetic:").nullable(),
  content_fingerprint: z.string().regex(/^(?:sha256|synthetic):[^\s]+$/),
  mime_type: z.string().min(1), extension: z.string(),
  byte_size: z.number().int().nonnegative(), building_id: z.string().min(1).nullable(),
  building_alias_candidate: z.string().min(1).nullable(), source_organization: z.string().min(1),
  document_category: z.enum(["perspective_render", "building_flyer", "portfolio_flyer", "floor_plan", "area_workbook", "legal_document"]),
  document_type: z.enum(["monthly_owner_update", "floor_plan", "leasing_flyer", "area_workbook", "legal_document"]),
  source_format: z.enum(["json", "pdf", "xlsx", "docx", "svg", "dwg", "dxf", "other"]),
  source_origin: z.enum(["synthetic_seed", "ephemeral_private_qa"]),
  review_policy: z.enum(["publishable_reference", "review_only", "manual_review"]),
  reviewed_summary: z.string().min(1).max(2_000).nullable(),
  artifact_date: dateSchema.nullable(), effective_date: dateSchema.nullable(),
  confidentiality: z.enum(["internal", "restricted", "legal_restricted", "public_candidate"]),
  externally_shareable: z.boolean(), status: z.enum(["registered", "steward_confirmed", "published", "superseded", "duplicate", "rejected"]),
  classification_state: z.enum(["candidate", "confirmed", "manual_review"]), version_family: z.string().min(1),
  segmentation_marker: z.string().min(1).nullable(), linked_file_version_id: z.string().min(1).nullable(),
  duplicate_of: z.string().min(1).nullable(), supersedes: z.string().min(1).nullable(),
  extraction_method: z.enum(["deterministic_metadata", "text_candidate", "manual"]),
  extraction_state: z.enum(["not_started", "candidate_ready", "unsupported", "reviewed"]),
  review_decision: z.enum(["pending", "confirmed", "rejected"]), reviewed_by: z.string().min(1).nullable(),
  reviewed_at: z.string().datetime().nullable(), active: z.boolean(), authorized: z.boolean(),
  audit_provenance: z.array(assetAuditProvenanceSchema).min(1),
}).strict();
const persistedDemoStateSchema = z.object({
  schema_version: z.literal(3),
  source_id: z.literal("src-cobalt-jul"),
  revision: z.number().int().nonnegative(),
  effective_date: dateSchema,
  publication_scope: z.object({
    building_id: z.string().min(1),
    floor: z.string().min(1),
  }).strict(),
  stage: z.enum(["source_uploaded", "extracted_candidate", "junior_confirmed", "senior_approved", "published"]),
  candidates: z.array(candidateSchema),
  records: z.array(recordSchema),
  files: z.array(fileSchema),
  audit: z.array(auditSchema),
  asset_registry: z.object({ assets: z.array(sourceAssetSchema) }).strict(),
  operations: operationalStateSchema,
}).strict();

const canonicalDocumentAssetKeys = [
  "content_fingerprint",
  "document_type",
  "source_format",
  "source_origin",
  "review_policy",
  "reviewed_summary",
] as const;

function hasPersistedDocumentLifecycleFields(asset: Record<string, unknown>): boolean {
  return canonicalDocumentAssetKeys.every((key) => key in asset);
}

export type DemoRuntimeState = DemoState;

export type RegisterDocumentAssetStoreInput = Omit<
  RegisterDocumentAssetInput,
  "actor" | "occurred_at"
> & {
  actor_id: string;
  expected_revision: number;
  candidate_summary?: string | null;
  occurred_at?: string;
};

function assertOperationalStateInvariants(state: DemoRuntimeState): void {
  const unique = (values: readonly string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`duplicate ${label} id`);
  };
  unique(state.operations.requests.map((item) => item.id), "operational request");
  unique(state.operations.packages.map((item) => item.id), "operational package");
  unique(state.operations.activities.map((item) => item.id), "operational activity");
  unique(state.operations.audit.map((item) => item.id), "operational audit");
  const requestIds = new Set(state.operations.requests.map((item) => item.id));
  const packageIds = new Set(state.operations.packages.map((item) => item.id));
  for (const item of state.operations.packages) {
    if (!requestIds.has(item.request_id)) throw new Error(`package ${item.id} references a missing request`);
    if (item.status === "sent" && (!item.sent_at || !item.idempotency_key || !item.approved_by)) {
      throw new Error(`sent package ${item.id} is missing approval or idempotency evidence`);
    }
  }
  for (const activity of state.operations.activities) {
    if (!packageIds.has(activity.package_id)) throw new Error(`activity ${activity.id} references a missing package`);
  }
  unique(state.operations.reports.reports.map((item) => item.id), "weekly report");
  unique(state.operations.reports.activities.map((item) => item.id), "weekly report activity");
  unique(state.operations.reports.audit.map((item) => item.id), "weekly report audit");
  const reportIds = new Set(state.operations.reports.reports.map((item) => item.id));
  for (const report of state.operations.reports.reports) assertWeeklyReportIntegrity(report);
  for (const activity of state.operations.reports.activities) {
    if (!reportIds.has(activity.report_id)) throw new Error(`report activity ${activity.id} references a missing report`);
  }
  for (const event of state.operations.reports.audit) {
    if (!reportIds.has(event.report_id)) throw new Error(`report audit ${event.id} references a missing report`);
  }
}

function assertAssetRegistryInvariants(state: DemoRuntimeState): void {
  const ids = state.asset_registry.assets.map((asset) => asset.id);
  const fingerprints = state.asset_registry.assets.map((asset) => asset.content_fingerprint);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate governed source asset id");
  if (new Set(fingerprints).size !== fingerprints.length) throw new Error("exact fingerprint must resolve to one governed source asset");
  const fileIds = new Set(state.files.map((file) => file.id));
  for (const asset of state.asset_registry.assets) {
    if (asset.linked_file_version_id && !fileIds.has(asset.linked_file_version_id)) {
      throw new Error(`source asset ${asset.id} references a missing linked file version`);
    }
  }
}

function migratePersistedState(value: unknown): unknown {
  const candidate = value as { schema_version?: unknown; operations?: unknown };
  if (candidate?.schema_version === 1) {
    return migrateDemoStateToV3({
      ...(value as Record<string, unknown>),
      schema_version: 2,
      operations: { requests: [], packages: [], activities: [], audit: [], reports: createInitialWeeklyReportState() },
    } as unknown as LegacyDemoStateV2);
  }
  if (candidate?.schema_version === 2) {
    return migrateDemoStateToV3(value as LegacyDemoStateV2);
  }
  if (candidate?.schema_version === 3 && !("asset_registry" in (value as Record<string, unknown>))) {
    return migrateDemoStateToV3(value as LegacyDemoStateV2);
  }
  if (candidate?.schema_version === 3) {
    const current = value as DemoRuntimeState;
    return {
      ...current,
      asset_registry: migrateGovernedAssetRegistryToDocumentLifecycle(current.asset_registry),
    };
  }
  return value;
}

function runtimeSeed(): DemoRuntimeState {
  return parsePersistedState(createInitialDemoState());
}

function parsePersistedState(value: unknown): DemoRuntimeState {
  try {
    const state = persistedDemoStateSchema.parse(migratePersistedState(value)) as DemoRuntimeState;
    assertGovernedPublicationStateInvariants(state);
    assertOperationalStateInvariants(state);
    assertAssetRegistryInvariants(state);
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid state";
    throw new DemoStateCorruptError(message);
  }
}

const pathLocks = new Map<string, Promise<void>>();

async function withPathLock<T>(storePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = pathLocks.get(storePath) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  pathLocks.set(storePath, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (pathLocks.get(storePath) === tail) pathLocks.delete(storePath);
  }
}

/**
 * DEMO_MODE local adapter for one Node process. The promise lock is not a
 * production/multi-instance guarantee; a Supabase compare-and-swap adapter is
 * the intended later deployment boundary.
 */
export class DemoFileStore {
  readonly storePath: string;
  private readonly configLoader: () => Promise<DemoRuntimeConfiguration>;
  private readonly reportDraftLoader: (buildingId: string) => Promise<CreateWeeklyReportDraftInput>;

  constructor(
    storePath = process.env.LEASEFLOW_DEMO_STATE_PATH ?? defaultStorePath(),
    configLoader: () => Promise<DemoRuntimeConfiguration> = loadDemoRuntimeConfiguration,
    reportDraftLoader: (buildingId: string) => Promise<CreateWeeklyReportDraftInput> = loadCanonicalWeeklyReportDraft,
  ) {
    this.storePath = path.resolve(storePath);
    this.configLoader = configLoader;
    this.reportDraftLoader = reportDraftLoader;
  }

  async getState(): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, () => this.readOrInitialize());
  }

  getCanonicalWeeklyReportDraft(buildingId: string): Promise<CreateWeeklyReportDraftInput> {
    return this.reportDraftLoader(buildingId);
  }

  async snapshotForDemoReset(input: { actor_id: string; expected_revision: number }): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      this.resolveActor(input.actor_id);
      const current = await this.readOrInitialize();
      this.requireRevision(current, input.expected_revision);
      return structuredClone(current);
    });
  }

  async restoreAfterFailedDemoReset(snapshot: DemoRuntimeState): Promise<void> {
    return withPathLock(this.storePath, async () => {
      await this.writeState(structuredClone(snapshot));
    });
  }

  async reset(input: { actor_id: string; expected_revision: number; occurred_at?: string }): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const actor = this.resolveActor(input.actor_id);
      const current = await this.readOrInitialize();
      this.requireRevision(current, input.expected_revision);
      const seed = runtimeSeed();
      const resetState: DemoRuntimeState = {
        ...seed,
        revision: current.revision + 1,
        audit: [...current.audit, {
          id: `audit-${current.audit.length + 1}`,
          event_type: "demo.reset",
          actor_id: actor.id,
          actor_role: actor.role,
          entity_type: "demo",
          entity_id: seed.source_id,
          occurred_at: input.occurred_at ?? new Date().toISOString(),
          metadata: { reset_from_revision: current.revision },
        }],
      };
      await this.writeState(resetState);
      return resetState;
    });
  }

  async extract(
    input: { actor_id: string; expected_revision: number; occurred_at?: string },
    extraction: unknown,
  ): Promise<DemoState> {
    const parsedExtraction = SourceCandidateSchema.parse(extraction);
    return this.mutate(input.expected_revision, (state) => recordExtraction(
      state,
      mapSourceCandidatesToDomain(state, parsedExtraction),
      this.resolveActor(input.actor_id),
      input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async confirm(input: { actor_id: string; expected_revision: number; occurred_at?: string }): Promise<DemoState> {
    return this.mutate(input.expected_revision, (state) => confirmCandidates(
      state,
      this.resolveActor(input.actor_id),
      input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async publish(input: { actor_id: string; expected_revision: number; occurred_at?: string }): Promise<DemoState> {
    return this.mutate(input.expected_revision, (state) => publishConfirmedBatch(
      state,
      this.resolveActor(input.actor_id),
      input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async confirmAsset(input: {
    actor_id: string; expected_revision: number; asset_id: string; building_id: string;
    externally_shareable: boolean; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutate(input.expected_revision, (state) => ({
      ...state,
      revision: state.revision + 1,
      asset_registry: confirmSourceAsset(state.asset_registry, {
        asset_id: input.asset_id,
        building_id: input.building_id,
        externally_shareable: input.externally_shareable,
        actor: this.resolveActor(input.actor_id),
        occurred_at: input.occurred_at ?? new Date().toISOString(),
      }),
    }));
  }

  async publishAsset(input: {
    actor_id: string; expected_revision: number; asset_id: string; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutate(input.expected_revision, (state) => ({
      ...state,
      revision: state.revision + 1,
      asset_registry: publishSourceAsset(state.asset_registry, {
        asset_id: input.asset_id,
        actor: this.resolveActor(input.actor_id),
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        current_linked_file_versions: new Map(state.files
          .filter((file) => file.status === "published" && !file.superseded && file.external_shareable)
          .map((file) => [file.id, file.building_id])),
      }),
    }));
  }

  async registerDocumentAsset(input: RegisterDocumentAssetStoreInput): Promise<DemoState> {
    const {
      actor_id: actorId,
      expected_revision: expectedRevision,
      candidate_summary: candidateSummary,
      occurred_at: occurredAt,
      ...document
    } = input;
    void candidateSummary;
    return this.mutateDocument(expectedRevision, (state) => registerGovernedDocumentAsset(
      state.asset_registry,
      {
        ...document,
        actor: this.resolveActor(actorId),
        occurred_at: occurredAt ?? new Date().toISOString(),
      },
    ));
  }

  async reviewDocumentAsset(input: {
    actor_id: string;
    expected_revision: number;
    asset_id?: string;
    document_id?: string;
    reviewed_summary: string;
    externally_shareable?: boolean;
    occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateDocument(input.expected_revision, (state) => reviewGovernedDocumentAsset(
      state.asset_registry,
      {
        ...(input.asset_id ? { asset_id: input.asset_id } : {}),
        ...(input.document_id ? { document_id: input.document_id } : {}),
        reviewed_summary: input.reviewed_summary,
        ...(input.externally_shareable !== undefined
          ? { externally_shareable: input.externally_shareable }
          : {}),
        actor: this.resolveActor(input.actor_id),
        occurred_at: input.occurred_at ?? new Date().toISOString(),
      },
    ));
  }

  async publishDocumentAsset(input: {
    actor_id: string;
    expected_revision: number;
    asset_id?: string;
    document_id?: string;
    occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateDocument(input.expected_revision, (state) => publishGovernedDocumentAsset(
      state.asset_registry,
      {
        ...(input.asset_id ? { asset_id: input.asset_id } : {}),
        ...(input.document_id ? { document_id: input.document_id } : {}),
        actor: this.resolveActor(input.actor_id),
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        current_linked_file_versions: new Map(state.files
          .filter((file) => file.status === "published" && !file.superseded && file.external_shareable)
          .map((file) => [file.id, file.building_id])),
      },
    ));
  }

  async importRequest(input: {
    actor_id: string; expected_revision: number; request_id: string; source: "call" | "email";
    source_id: string; raw_text: string; extraction: OperationalRequestExtraction; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => importOperationalRequest(
      state.operations,
      { id: input.request_id, source: input.source, source_id: input.source_id, raw_text: input.raw_text, extraction: input.extraction },
      this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async confirmRequest(input: { actor_id: string; expected_revision: number; request_id: string; occurred_at?: string }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => confirmOperationalRequest(
      state.operations, input.request_id, this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async draftPackage(input: { actor_id: string; expected_revision: number; request_id: string; occurred_at?: string }): Promise<DemoState> {
    const config = await this.configLoader();
    return this.mutateOperation(input.expected_revision, (state) => {
      if (state.stage !== "published") throw new Error("Package drafting requires the Stage 2 published state.");
      this.assertConfiguredAccess(config, input.actor_id, state.publication_scope.building_id);
      const request = state.operations.requests.find((item) => item.id === input.request_id);
      if (!request || request.extraction.recipient.name !== config.recipients.recipient_name
        || request.extraction.recipient.organization !== config.recipients.recipient_organization) {
        throw new Error("Confirmed request recipient identity does not match configured broker package recipient group.");
      }
      if (config.recipients.building_id !== state.publication_scope.building_id) {
        throw new Error("No exact configured broker package recipient group exists for this building and purpose.");
      }
      return draftOperationalPackage(
        state.operations, input.request_id, createDemoDraftMaterial(state),
        { to: [...config.recipients.to], cc: [...config.recipients.cc], configuration_id: config.recipients.id },
        this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
      );
    });
  }

  async proposePackageEdit(input: {
    actor_id: string; expected_revision: number; package_id: string; subject: string; body: string; instruction: string; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => proposePackageEdit(
      state.operations, input.package_id,
      { subject: input.subject, body: input.body, instruction: input.instruction },
      this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async decidePackageEdit(input: {
    actor_id: string; expected_revision: number; package_id: string; decision: "accept" | "reject"; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => decidePackageEdit(
      state.operations, input.package_id, input.decision,
      this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async approvePackage(input: { actor_id: string; expected_revision: number; package_id: string; occurred_at?: string }): Promise<DemoState> {
    const config = await this.configLoader();
    return this.mutateOperation(input.expected_revision, (state) => {
      this.assertConfiguredAccess(config, input.actor_id, state.publication_scope.building_id);
      this.assertPackageCanonicalMaterial(state, input.package_id);
      this.assertPackageConfiguration(state, input.package_id, config);
      return approveOperationalPackage(
        state.operations, input.package_id, this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
      );
    });
  }

  async sendPackage(input: {
    actor_id: string; expected_revision: number; package_id: string; idempotency_key: string; occurred_at?: string;
  }): Promise<DemoState> {
    const config = await this.configLoader();
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.assertConfiguredAccess(config, input.actor_id, state.publication_scope.building_id);
      this.assertPackageConfiguration(state, input.package_id, config);
      this.assertPackageCanonicalMaterial(state, input.package_id);
      const existing = state.operations.packages.find((item) => item.id === input.package_id);
      if (existing?.status === "sent" && existing.idempotency_key === input.idempotency_key) {
        assertOperationalPackageContentIntegrity(existing);
        return state;
      }
      this.requireRevision(state, input.expected_revision);
      const operations = sendOperationalPackage(
        state.operations, input.package_id, input.idempotency_key, currentDemoMaterialVersionIds(state),
        this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
      );
      const next: DemoRuntimeState = {
        ...state,
        revision: state.revision + 1,
        operations: { ...operations, reports: state.operations.reports },
      };
      this.assertOfficialProjectionUnchanged(state, next);
      await this.writeState(next);
      return next;
    });
  }

  async draftWeeklyReport(input: {
    actor_id: string;
    expected_revision: number;
    draft: CreateWeeklyReportDraftInput;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return this.mutateReport(input.expected_revision, async (state) => {
      const [config, canonicalDraft] = await Promise.all([
        this.configLoader(),
        this.reportDraftLoader(input.draft.building_id),
      ]);
      if (state.stage !== "published") throw new Error("Weekly report drafting requires the Stage 2 published state.");
      this.assertConfiguredAccess(config, input.actor_id, input.draft.building_id);
      this.assertCanonicalWeeklyReportDraft(input.draft, canonicalDraft);
      const authority = this.findReportAuthority(config, input.draft.building_id);
      if (!authority) throw new WeeklyReportStaleError(state.revision);
      if (input.actor_id !== authority.owner_user_id && input.actor_id !== authority.approver_user_id) {
        throw new WorkflowAccessError("저장된 업무 담당자 또는 승인자만 이 건물 보고를 준비할 수 있습니다.");
      }
      const reports = createWeeklyReportDraft(
        state.operations.reports,
        {
          ...input.draft,
          sections: applyConfiguredWeeklyReportSections(
            input.draft.sections,
            authority.automation.required_section_keys,
          ),
          recipients: {
            configuration_id: authority.configuration_id,
            to: authority.recipients.to.map(({ email, role }) => ({ email, role })),
            cc: authority.recipients.cc.map(({ email, role }) => ({ email, role })),
          },
        },
        this.currentWeeklyReportMaterialIds(canonicalDraft),
        this.resolveActor(input.actor_id),
        input.occurred_at ?? new Date().toISOString(),
      );
      const audit = [...reports.audit];
      const draftedEvent = audit.at(-1);
      if (!draftedEvent) throw new Error("Weekly-report drafting did not produce the required audit event.");
      audit[audit.length - 1] = {
        ...draftedEvent,
        metadata: {
          ...draftedEvent.metadata,
          report_group_ref: authority.group_ref,
          recipient_configuration_id: authority.configuration_id,
          approver_user_id: authority.approver_user_id,
          settings_revision: authority.settings_revision,
        },
      };
      return { ...reports, audit };
    });
  }

  async proposeWeeklyReportPatch(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    candidate: WeeklyReportPatchCandidate;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, input.expected_revision);
      const occurredAt = input.occurred_at ?? new Date().toISOString();
      await this.requireCurrentWeeklyReportPreparation(state, input.actor_id, input.report_id, occurredAt);
      return this.persistReportMutation(state, proposeWeeklyReportPatch(
        state.operations.reports,
        input.report_id,
        input.candidate,
        this.resolveActor(input.actor_id),
        occurredAt,
      ));
    });
  }

  async decideWeeklyReportPatch(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    decision: "accept" | "reject";
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, input.expected_revision);
      const occurredAt = input.occurred_at ?? new Date().toISOString();
      await this.requireCurrentWeeklyReportPreparation(state, input.actor_id, input.report_id, occurredAt);
      return this.persistReportMutation(state, decideWeeklyReportPatch(
        state.operations.reports,
        input.report_id,
        input.decision,
        this.resolveActor(input.actor_id),
        occurredAt,
      ));
    });
  }

  async assertWeeklyReportPreparationAccess(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    occurred_at?: string;
  }): Promise<void> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, input.expected_revision);
      await this.requireCurrentWeeklyReportPreparation(
        state,
        input.actor_id,
        input.report_id,
        input.occurred_at ?? new Date().toISOString(),
      );
    });
  }

  async approveWeeklyReport(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      const report = this.requireWeeklyReport(state, input.report_id);
      const [config, canonicalDraft] = await Promise.all([
        this.configLoader(),
        this.reportDraftLoader(report.building_id),
      ]);
      this.assertConfiguredAccess(config, input.actor_id, report.building_id);
      this.requireRevision(state, input.expected_revision);
      const actor = this.resolveActor(input.actor_id);
      const occurredAt = input.occurred_at ?? new Date().toISOString();
      const currentReports = this.markReportStaleForCurrentInputs(
        state,
        input.report_id,
        config,
        canonicalDraft,
        actor,
        occurredAt,
      );
      if (currentReports !== state.operations.reports) {
        await this.persistReportMutation(state, currentReports);
        throw new WeeklyReportStaleError(state.revision + 1);
      }
      const authority = this.findReportAuthority(config, report.building_id);
      if (!authority) throw new WeeklyReportStaleError(state.revision);
      if (input.actor_id !== authority.approver_user_id) {
        throw new WorkflowAccessError("이 건물 보고에 저장된 최종 승인자만 승인할 수 있습니다.");
      }
      const reports = approveWeeklyReport(
        state.operations.reports,
        input.report_id,
        this.currentWeeklyReportMaterialIds(canonicalDraft),
        authority.configuration_id,
        actor,
        occurredAt,
      );
      return this.persistReportMutation(state, reports);
    });
  }

  async sendWeeklyReport(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    idempotency_key: string;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      const report = this.requireWeeklyReport(state, input.report_id);
      const [config, canonicalDraft] = await Promise.all([
        this.configLoader(),
        this.reportDraftLoader(report.building_id),
      ]);
      this.assertConfiguredAccess(config, input.actor_id, report.building_id);
      assertWeeklyReportIntegrity(report);
      if (report.status === "sent" && report.delivery.idempotency_key === input.idempotency_key) return state;
      this.requireRevision(state, input.expected_revision);
      const actor = this.resolveActor(input.actor_id);
      const occurredAt = input.occurred_at ?? new Date().toISOString();
      const currentReports = this.markReportStaleForCurrentInputs(
        state,
        input.report_id,
        config,
        canonicalDraft,
        actor,
        occurredAt,
      );
      if (currentReports !== state.operations.reports) {
        await this.persistReportMutation(state, currentReports);
        throw new WeeklyReportStaleError(state.revision + 1);
      }
      const authority = this.findReportAuthority(config, report.building_id);
      if (!authority) throw new WeeklyReportStaleError(state.revision);
      if (report.approval.approved_by !== authority.approver_user_id) {
        throw new Error("현재 설정에 저장된 최종 승인자의 확인이 필요합니다.");
      }
      const reports = sendWeeklyReport(
        state.operations.reports,
        input.report_id,
        input.idempotency_key,
        this.currentWeeklyReportMaterialIds(canonicalDraft),
        authority.configuration_id,
        actor,
        occurredAt,
      );
      return this.persistReportMutation(state, reports);
    });
  }

  private resolveActor(actorId: string): { id: string; role: UserRole } {
    const user = demoUsers.find((candidate) => candidate.id === actorId);
    if (!user) throw new Error(`Unknown demo actor: ${actorId}.`);
    return { id: user.id, role: user.role };
  }

  private assertConfiguredAccess(config: DemoRuntimeConfiguration, userId: string, buildingId: string): void {
    const access = config.access.users.find((item) => item.user_id === userId);
    if (!access?.building_ids.includes(buildingId)) {
      throw new Error(`Demo user ${userId} is not authorized for building ${buildingId}.`);
    }
  }

  private findReportAuthority(
    config: DemoRuntimeConfiguration,
    buildingId: string,
  ): ConfiguredWeeklyReportAuthority | undefined {
    return config.reportAuthorities?.find((item) => item.building_id === buildingId);
  }

  private requireWeeklyReport(state: DemoRuntimeState, reportId: string) {
    const report = state.operations.reports.reports.find((item) => item.id === reportId);
    if (!report) throw new Error(`Unknown weekly report: ${reportId}.`);
    return report;
  }

  private currentWeeklyReportMaterialIds(
    canonicalDraft: CreateWeeklyReportDraftInput,
  ): Set<string> {
    return new Set([
      ...canonicalDraft.material_version_ids,
      ...canonicalDraft.attachments.map((attachment) => attachment.version_id),
      ...canonicalDraft.sources.map((source) => source.id),
    ]);
  }

  private assertCanonicalWeeklyReportDraft(
    draft: CreateWeeklyReportDraftInput,
    canonical: CreateWeeklyReportDraftInput,
  ): void {
    const normalizedSources = (items: WeeklyReportState["reports"][number]["sources"]) => [...items]
      .map((source) => ({ ...source }))
      .sort((left, right) => left.id.localeCompare(right.id) || JSON.stringify(left).localeCompare(JSON.stringify(right)));
    const protectedInput = (input: CreateWeeklyReportDraftInput) => ({
      id: input.id,
      building_id: input.building_id,
      reporting_period: input.reporting_period,
      sections: input.sections,
      sources: normalizedSources(input.sources),
      attachments: [...input.attachments].sort((left, right) => left.id.localeCompare(right.id)),
      material_version_ids: [...input.material_version_ids].sort(),
      cover: input.cover,
      unresolved: input.unresolved ?? [],
    });
    if (JSON.stringify(protectedInput(draft)) !== JSON.stringify(protectedInput(canonical))) {
      throw new Error("Weekly-report draft diverged from the canonical current building-specific material set.");
    }
  }

  private async requireCurrentWeeklyReportPreparation(
    state: DemoRuntimeState,
    actorId: string,
    reportId: string,
    occurredAt: string,
  ): Promise<void> {
    const report = this.requireWeeklyReport(state, reportId);
    const [config, canonicalDraft] = await Promise.all([
      this.configLoader(),
      this.reportDraftLoader(report.building_id),
    ]);
    this.assertConfiguredAccess(config, actorId, report.building_id);
    const actor = this.resolveActor(actorId);
    const currentReports = this.markReportStaleForCurrentInputs(
      state,
      reportId,
      config,
      canonicalDraft,
      actor,
      occurredAt,
    );
    if (currentReports !== state.operations.reports) {
      await this.persistReportMutation(state, currentReports);
      throw new WeeklyReportStaleError(state.revision + 1);
    }
    const authority = this.findReportAuthority(config, report.building_id);
    if (!authority) throw new WeeklyReportStaleError(state.revision);
    if (actorId !== authority.owner_user_id && actorId !== authority.approver_user_id) {
      throw new WorkflowAccessError("저장된 업무 담당자 또는 승인자만 이 건물 보고를 변경할 수 있습니다.");
    }
  }

  private markReportStaleForCurrentInputs(
    state: DemoRuntimeState,
    reportId: string,
    config: DemoRuntimeConfiguration,
    canonicalDraft: CreateWeeklyReportDraftInput,
    actor: { id: string; role: UserRole },
    occurredAt: string,
  ): WeeklyReportState {
    const currentAuthority = config.reportAuthorities?.find((item) => item.building_id === canonicalDraft.building_id);
    const currentRecipientConfigurationId = currentAuthority?.configuration_id
      ?? "missing-weekly-report-recipient-configuration";
    return markWeeklyReportStale(
      state.operations.reports,
      reportId,
      this.currentWeeklyReportMaterialIds(canonicalDraft),
      currentRecipientConfigurationId,
      actor,
      occurredAt,
      {
        current_sources: canonicalDraft.sources,
        ...(currentAuthority ? {
          current_recipients: {
            configuration_id: currentAuthority.configuration_id,
            to: currentAuthority.recipients.to,
            cc: currentAuthority.recipients.cc,
          },
        } : { recipient_content_drift: true }),
      },
    );
  }

  private async persistReportMutation(
    state: DemoRuntimeState,
    reports: WeeklyReportState,
  ): Promise<DemoRuntimeState> {
    const next: DemoRuntimeState = {
      ...state,
      revision: state.revision + 1,
      operations: { ...state.operations, reports },
    };
    this.assertOfficialProjectionUnchanged(state, next);
    await this.writeState(next);
    return next;
  }

  private assertPackageConfiguration(state: DemoState, packageId: string, config: DemoRuntimeConfiguration): void {
    const pkg = state.operations.packages.find((item) => item.id === packageId);
    if (!pkg) throw new Error(`Unknown package: ${packageId}.`);
    if (config.recipients.building_id !== pkg.building_id
      || pkg.recipients.configuration_id !== config.recipients.id
      || JSON.stringify(pkg.recipients.to) !== JSON.stringify(config.recipients.to)
      || JSON.stringify(pkg.recipients.cc) !== JSON.stringify(config.recipients.cc)) {
      throw new Error("Package recipients or authorization configuration diverged from the current exact configuration.");
    }
  }

  private async mutate(expectedRevision: number, command: (state: DemoRuntimeState) => DemoRuntimeState): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, expectedRevision);
      const next = command(state);
      await this.writeState(next);
      return next;
    });
  }

  private async mutateOperation(
    expectedRevision: number,
    command: (state: DemoRuntimeState) => OperationalState,
  ): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, expectedRevision);
      const operations = command(state);
      const next: DemoRuntimeState = {
        ...state,
        revision: state.revision + 1,
        operations: { ...operations, reports: state.operations.reports },
      };
      this.assertOfficialProjectionUnchanged(state, next);
      await this.writeState(next);
      return next;
    });
  }

  private async mutateDocument(
    expectedRevision: number,
    command: (state: DemoRuntimeState) => GovernedAssetRegistry,
  ): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, expectedRevision);
      const next: DemoRuntimeState = {
        ...state,
        revision: state.revision + 1,
        asset_registry: command(state),
      };
      this.assertDocumentLifecycleOfficialStateUnchanged(state, next);
      await this.writeState(next);
      return next;
    });
  }

  private async mutateReport(
    expectedRevision: number,
    command: (state: DemoRuntimeState) => WeeklyReportState | Promise<WeeklyReportState>,
  ): Promise<DemoRuntimeState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, expectedRevision);
      const next: DemoRuntimeState = {
        ...state,
        revision: state.revision + 1,
        operations: { ...state.operations, reports: await command(state) },
      };
      this.assertOfficialProjectionUnchanged(state, next);
      await this.writeState(next);
      return next;
    });
  }

  private assertPackageCanonicalMaterial(state: DemoRuntimeState, packageId: string): void {
    const target = state.operations.packages.find((item) => item.id === packageId);
    if (!target) throw new Error(`Unknown package: ${packageId}.`);
    const request = state.operations.requests.find((item) => item.id === target.request_id);
    if (!request) throw new Error(`Package ${packageId} references an unknown request.`);
    const material = createDemoDraftMaterial(state);
    const canonicalFacts = request.extraction.requested_fields.map((field) => {
      const fact = material.facts.find((item) => item.field === field);
      if (!fact) throw new Error(`No current published fact is available for ${field}.`);
      return fact;
    });
    const canonicalFiles = request.extraction.requested_files.map((requestedFile) => {
      const file = material.files.find((item) => item.requested_file === requestedFile);
      if (!file) throw new Error(`No current published file is available for ${requestedFile}.`);
      return file;
    });
    if (target.building_id !== material.building_id
      || target.floor !== material.floor
      || JSON.stringify(target.facts) !== JSON.stringify(canonicalFacts)
      || JSON.stringify(target.files) !== JSON.stringify(canonicalFiles)) {
      throw new Error("Package protected material diverged from the current canonical published material.");
    }
  }

  private assertOfficialProjectionUnchanged(before: DemoRuntimeState, after: DemoRuntimeState): void {
    const project = (state: DemoRuntimeState) => ({
      source_id: state.source_id, effective_date: state.effective_date, publication_scope: state.publication_scope,
      stage: state.stage, candidates: state.candidates, records: state.records, files: state.files,
      asset_registry: state.asset_registry, audit: state.audit,
    });
    if (JSON.stringify(project(before)) !== JSON.stringify(project(after))) {
      throw new Error("Operational workflow attempted to mutate official publication data.");
    }
  }

  private assertDocumentLifecycleOfficialStateUnchanged(
    before: DemoRuntimeState,
    after: DemoRuntimeState,
  ): void {
    const officialState = (state: DemoRuntimeState) => ({
      stage: state.stage,
      candidates: state.candidates,
      records: state.records,
      files: state.files,
    });
    if (JSON.stringify(officialState(before)) !== JSON.stringify(officialState(after))
      || JSON.stringify(createDemoDraftMaterial(before)) !== JSON.stringify(createDemoDraftMaterial(after))) {
      throw new Error("Document lifecycle attempted to mutate official publication material.");
    }
  }

  private requireRevision(state: DemoRuntimeState, expected: number): void {
    if (state.revision !== expected) throw new RevisionConflictError(expected, state.revision);
  }

  private async readOrInitialize(): Promise<DemoRuntimeState> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      const parsedRecord = parsed as Record<string, unknown>;
      const parsedAssets = (parsedRecord.asset_registry as { assets?: Array<Record<string, unknown>> } | undefined)?.assets;
      const shouldPersistMigration = (parsed as { schema_version?: unknown }).schema_version === 1
        || (parsed as { schema_version?: unknown }).schema_version === 2
        || ((parsed as { schema_version?: unknown }).schema_version === 3
          && (!("asset_registry" in parsedRecord)
            || parsedAssets?.some((asset) => !hasPersistedDocumentLifecycleFields(asset)) === true));
      const state = parsePersistedState(parsed);
      if (shouldPersistMigration) await this.writeValidatedState(state);
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const initial = runtimeSeed();
        await this.writeState(initial);
        return initial;
      }
      if (error instanceof DemoStateCorruptError) throw error;
      if (error instanceof SyntaxError) throw new DemoStateCorruptError(error.message);
      throw error;
    }
  }

  private async writeState(state: DemoRuntimeState): Promise<void> {
    const validated = parsePersistedState(state);
    await this.writeValidatedState(validated);
  }

  private async writeValidatedState(validated: DemoRuntimeState): Promise<void> {
    const directory = path.dirname(this.storePath);
    await mkdir(directory, { recursive: true });
    const tempPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(tempPath, this.storePath);
  }
}

let singleton: DemoFileStore | undefined;

export function getDemoStore(): DemoFileStore {
  singleton ??= new DemoFileStore();
  return singleton;
}
