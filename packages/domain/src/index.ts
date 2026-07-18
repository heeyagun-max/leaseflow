export type PublicationStatus =
  | "candidate"
  | "junior_confirmed"
  | "senior_approved"
  | "published"
  | "superseded"
  | "rejected";

export type UserRole =
  | "data_steward"
  | "senior_reviewer"
  | "lm_manager"
  | "lm_member"
  | "team_lead"
  | "admin";

export interface VersionedRecord {
  id: string;
  building_id: string;
  version_no: number;
  status: PublicationStatus;
  valid_from: string;
  valid_to: string | null;
  superseded: boolean;
  external_shareable: boolean;
}

export interface FileVersion extends VersionedRecord {
  floor: string;
  filename: string;
}

export type PublicationStage =
  | "source_uploaded"
  | "extracted_candidate"
  | "junior_confirmed"
  | "senior_approved"
  | "published";

export const EXPECTED_PUBLICATION_FIELDS = [
  "marketed_area_py",
  "floor_plan",
  "rent_free_months",
  "supported_parking_spaces",
] as const;

export type ExpectedPublicationField = (typeof EXPECTED_PUBLICATION_FIELDS)[number];

export interface PublicationScope {
  building_id: string;
  floor: string;
}

export interface CandidateChange {
  id: string;
  building_id: string;
  field: ExpectedPublicationField;
  floor: string;
  target_type: "record" | "file";
  predecessor_version_id: string;
  candidate_version_id: string;
  previous_value: unknown;
  proposed_value: unknown;
  source_state: "confirmed" | "under_discussion" | "unverified";
  source_pointer: string;
  confidence: number;
  external_shareable_candidate: boolean;
  status: "candidate" | "junior_confirmed" | "published";
}

export interface AuditEvent {
  id: string;
  event_type:
    | "source.extracted"
    | "candidate.confirmed"
    | "batch.senior_approved"
    | "batch.published"
    | "demo.reset";
  actor_id: string;
  actor_role: UserRole;
  entity_type: "source" | "candidate_batch" | "publication_batch" | "demo";
  entity_id: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface GovernedPublicationState<
  TRecord extends VersionedRecord = VersionedRecord,
  TFile extends FileVersion = FileVersion,
> {
  revision: number;
  effective_date: string;
  publication_scope: PublicationScope;
  stage: PublicationStage;
  candidates: CandidateChange[];
  records: TRecord[];
  files: TFile[];
  audit: AuditEvent[];
}

const transitions: Record<PublicationStage, readonly PublicationStage[]> = {
  source_uploaded: ["extracted_candidate"],
  extracted_candidate: ["junior_confirmed"],
  junior_confirmed: ["senior_approved"],
  senior_approved: ["published"],
  published: [],
};

export function assertTransition(from: PublicationStage, to: PublicationStage): void {
  if (!transitions[from].includes(to)) {
    throw new Error(`Illegal publication transition: ${from} -> ${to}.`);
  }
}

export function selectCurrentPublished<T extends VersionedRecord>(
  records: readonly T[],
  asOf = new Date(),
): T | null {
  const stamp = asOf.toISOString().slice(0, 10);
  const eligible = records.filter((record) =>
    record.status === "published" &&
    !record.superseded &&
    record.valid_from <= stamp &&
    (record.valid_to === null || record.valid_to >= stamp),
  );

  if (eligible.length > 1) {
    throw new Error("Invariant violation: multiple current published records are eligible.");
  }
  return eligible[0] ?? null;
}

export function requireExternalRecord<T extends VersionedRecord>(record: T | null): T {
  if (!record) throw new Error("No current published record is available.");
  if (!record.external_shareable) {
    throw new Error("The current record is not approved for external sharing.");
  }
  return record;
}

export function selectCurrentFloorPlan<T extends FileVersion>(
  files: readonly T[],
  buildingId: string,
  floor: string,
  asOf = new Date(),
): T {
  const current = selectCurrentPublished(
    files.filter((file) => file.building_id === buildingId && file.floor === floor),
    asOf,
  );
  return requireExternalRecord(current);
}

export function canPerform(role: UserRole, action: string): boolean {
  const permissions: Record<UserRole, string[]> = {
    data_steward: ["source.upload", "candidate.confirm"],
    senior_reviewer: ["candidate.review", "record.publish"],
    lm_manager: ["package.prepare", "package.approve", "package.send", "report.approve"],
    lm_member: ["package.prepare", "report.prepare"],
    team_lead: ["package.prepare", "report.prepare", "report.approve"],
    admin: ["*"],
  };
  return permissions[role].includes("*") || permissions[role].includes(action);
}

function requireAction(role: UserRole, action: string): void {
  if (!canPerform(role, action)) {
    throw new Error(`Role ${role} is not allowed to perform ${action}.`);
  }
}

function auditEvent(
  state: GovernedPublicationState,
  input: Omit<AuditEvent, "id">,
): AuditEvent {
  return { ...input, id: `audit-${state.audit.length + 1}` };
}

const expectedTargetType: Record<ExpectedPublicationField, CandidateChange["target_type"]> = {
  marketed_area_py: "record",
  floor_plan: "file",
  rent_free_months: "record",
  supported_parking_spaces: "record",
};

interface CandidateRecordTarget extends VersionedRecord {
  floor: string;
  field: string;
  value: unknown;
}

function isCandidateRecordTarget(value: VersionedRecord): value is CandidateRecordTarget {
  const candidate = value as Partial<CandidateRecordTarget>;
  return typeof candidate.floor === "string"
    && typeof candidate.field === "string"
    && Object.prototype.hasOwnProperty.call(candidate, "value");
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function assertUniqueIds(items: readonly { id: string }[], label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Invariant violation: duplicate ${label} id ${item.id}.`);
    ids.add(item.id);
  }
}

function assertVersionHistoryInvariants(items: readonly VersionedRecord[], kind: "record" | "file"): void {
  const histories = new Map<string, VersionedRecord[]>();
  for (const item of items) {
    if ((item.status === "superseded") !== item.superseded) {
      throw new Error(`Invariant violation: ${kind} ${item.id} has inconsistent superseded state.`);
    }
    if (item.valid_to !== null && item.valid_to < item.valid_from) {
      throw new Error(`Invariant violation: ${kind} ${item.id} has an invalid effective-date range.`);
    }
    const shaped = item as VersionedRecord & { floor?: unknown; field?: unknown; file_type?: unknown };
    const discriminator = kind === "record"
      ? `${String(shaped.floor ?? "")}|${String(shaped.field ?? item.id)}`
      : `${String(shaped.floor ?? "")}|${String(shaped.file_type ?? "file")}`;
    const key = `${item.building_id}|${discriminator}`;
    histories.set(key, [...(histories.get(key) ?? []), item]);
  }

  for (const history of histories.values()) {
    const versions = new Set<number>();
    for (const item of history) {
      if (versions.has(item.version_no)) {
        throw new Error("Invariant violation: duplicate version number in one version history.");
      }
      versions.add(item.version_no);
    }
    const current = history.filter((item) => item.status === "published" && !item.superseded);
    if (current.length > 1) {
      throw new Error("Invariant violation: multiple current published versions in one version history.");
    }
  }
}

function assertExpectedCandidateSet(
  state: GovernedPublicationState,
  options: {
    candidateStatus: CandidateChange["status"];
    lifecycle: "prepublication" | "published";
    requirePublishable: boolean;
  },
): void {
  if (state.candidates.length !== EXPECTED_PUBLICATION_FIELDS.length) {
    throw new Error(`Publication requires exactly ${EXPECTED_PUBLICATION_FIELDS.length} scoped candidates.`);
  }

  assertUniqueIds(state.candidates, "candidate");
  const fields = new Set(state.candidates.map((candidate) => candidate.field));
  if (fields.size !== EXPECTED_PUBLICATION_FIELDS.length
    || EXPECTED_PUBLICATION_FIELDS.some((field) => !fields.has(field))) {
    throw new Error("Publication candidates do not match the four expected fields.");
  }

  const predecessorIds = new Set<string>();
  const candidateVersionIds = new Set<string>();
  for (const candidate of state.candidates) {
    if (candidate.status !== options.candidateStatus) {
      throw new Error(`Candidate ${candidate.id} has invalid workflow status ${candidate.status}.`);
    }
    if (candidate.building_id !== state.publication_scope.building_id
      || candidate.floor !== state.publication_scope.floor) {
      throw new Error(`Candidate ${candidate.id} is outside the publication scope.`);
    }
    if (candidate.target_type !== expectedTargetType[candidate.field]) {
      throw new Error(`Candidate ${candidate.id} targets the wrong entity type.`);
    }
    if (predecessorIds.has(candidate.predecessor_version_id)
      || candidateVersionIds.has(candidate.candidate_version_id)) {
      throw new Error("Publication candidates must target unique predecessor and candidate versions.");
    }
    predecessorIds.add(candidate.predecessor_version_id);
    candidateVersionIds.add(candidate.candidate_version_id);

    const collection: readonly VersionedRecord[] = candidate.target_type === "record"
      ? state.records
      : state.files;
    const predecessor = collection.find((item) => item.id === candidate.predecessor_version_id);
    const target = collection.find((item) => item.id === candidate.candidate_version_id);
    if (!predecessor || !target) {
      throw new Error(`Candidate ${candidate.id} references a missing version identity.`);
    }
    if (predecessor.building_id !== candidate.building_id || target.building_id !== candidate.building_id) {
      throw new Error(`Candidate ${candidate.id} references a version from another building.`);
    }
    if (target.version_no <= predecessor.version_no) {
      throw new Error(`Candidate ${candidate.id} does not advance the target version.`);
    }

    const predecessorValue = candidate.target_type === "record"
      ? (() => {
        if (!isCandidateRecordTarget(predecessor) || !isCandidateRecordTarget(target)) {
          throw new Error(`Candidate ${candidate.id} references an invalid record target.`);
        }
        if (predecessor.floor !== candidate.floor || target.floor !== candidate.floor
          || predecessor.field !== candidate.field || target.field !== candidate.field) {
          throw new Error(`Candidate ${candidate.id} references a different record field or floor.`);
        }
        return predecessor.value;
      })()
      : (() => {
        const previousFile = predecessor as FileVersion & { file_type?: string };
        const targetFile = target as FileVersion & { file_type?: string };
        if (previousFile.floor !== candidate.floor || targetFile.floor !== candidate.floor
          || (previousFile.file_type !== undefined && previousFile.file_type !== "floor_plan")
          || (targetFile.file_type !== undefined && targetFile.file_type !== "floor_plan")) {
          throw new Error(`Candidate ${candidate.id} references a different file type or floor.`);
        }
        return previousFile.filename;
      })();
    const targetValue = candidate.target_type === "record"
      ? (target as CandidateRecordTarget).value
      : (target as FileVersion).filename;
    if (!valuesEqual(candidate.previous_value, predecessorValue)) {
      throw new Error(`Candidate ${candidate.id} previous value does not match its predecessor version.`);
    }
    if (!valuesEqual(candidate.proposed_value, targetValue)) {
      throw new Error(`Candidate ${candidate.id} proposed value does not match its candidate version.`);
    }

    const expectedPredecessorStatus = options.lifecycle === "published" ? "superseded" : "published";
    const expectedTargetStatus = options.lifecycle === "published" ? "published" : "candidate";
    if (predecessor.status !== expectedPredecessorStatus
      || target.status !== expectedTargetStatus
      || predecessor.superseded !== (options.lifecycle === "published")
      || target.superseded) {
      throw new Error(`Candidate ${candidate.id} references versions in invalid publication states.`);
    }
    if (options.requirePublishable
      && (candidate.source_state !== "confirmed"
        || !candidate.external_shareable_candidate
        || !predecessor.external_shareable
        || !target.external_shareable)) {
      throw new Error(`Candidate ${candidate.id} is not confirmed and shareable.`);
    }
  }
}

export function assertGovernedPublicationStateInvariants(state: GovernedPublicationState): void {
  if (!state.publication_scope.building_id || !state.publication_scope.floor) {
    throw new Error("Invariant violation: publication scope is incomplete.");
  }
  assertUniqueIds(state.records, "record");
  assertUniqueIds(state.files, "file");
  assertUniqueIds([...state.records, ...state.files], "record/file");
  assertUniqueIds(state.audit, "audit");
  assertVersionHistoryInvariants(state.records, "record");
  assertVersionHistoryInvariants(state.files, "file");

  const statusByStage: Record<Exclude<PublicationStage, "source_uploaded">, CandidateChange["status"]> = {
    extracted_candidate: "candidate",
    junior_confirmed: "junior_confirmed",
    senior_approved: "junior_confirmed",
    published: "published",
  };
  if (state.stage === "source_uploaded") {
    if (state.candidates.length !== 0) {
      throw new Error("Invariant violation: source-uploaded state cannot contain extracted candidates.");
    }
    return;
  }
  assertExpectedCandidateSet(state, {
    candidateStatus: statusByStage[state.stage],
    lifecycle: state.stage === "published" ? "published" : "prepublication",
    requirePublishable: false,
  });
}

export function recordExtraction<T extends GovernedPublicationState>(
  state: T,
  candidates: readonly CandidateChange[],
  actor: { id: string; role: UserRole },
  occurredAt: string,
): T {
  requireAction(actor.role, "source.upload");
  assertTransition(state.stage, "extracted_candidate");
  const nextCandidates = candidates.map((candidate) => ({ ...candidate, status: "candidate" as const }));
  assertExpectedCandidateSet({ ...state, candidates: nextCandidates }, {
    candidateStatus: "candidate",
    lifecycle: "prepublication",
    requirePublishable: false,
  });
  return {
    ...state,
    revision: state.revision + 1,
    stage: "extracted_candidate",
    candidates: nextCandidates,
    audit: [...state.audit, auditEvent(state, {
      event_type: "source.extracted",
      actor_id: actor.id,
      actor_role: actor.role,
      entity_type: "source",
      entity_id: "src-cobalt-jul",
      occurred_at: occurredAt,
      metadata: { candidate_count: nextCandidates.length },
    })],
  };
}

export function confirmCandidates<T extends GovernedPublicationState>(
  state: T,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): T {
  requireAction(actor.role, "candidate.confirm");
  assertTransition(state.stage, "junior_confirmed");
  assertExpectedCandidateSet(state, {
    candidateStatus: "candidate",
    lifecycle: "prepublication",
    requirePublishable: false,
  });
  return {
    ...state,
    revision: state.revision + 1,
    stage: "junior_confirmed",
    candidates: state.candidates.map((candidate) => ({ ...candidate, status: "junior_confirmed" as const })),
    audit: [...state.audit, auditEvent(state, {
      event_type: "candidate.confirmed",
      actor_id: actor.id,
      actor_role: actor.role,
      entity_type: "candidate_batch",
      entity_id: "src-cobalt-jul",
      occurred_at: occurredAt,
      metadata: { candidate_count: state.candidates.length },
    })],
  };
}

export function publishConfirmedBatch<T extends GovernedPublicationState>(
  state: T,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): T {
  requireAction(actor.role, "record.publish");
  assertTransition(state.stage, "senior_approved");
  assertExpectedCandidateSet(state, {
    candidateStatus: "junior_confirmed",
    lifecycle: "prepublication",
    requirePublishable: true,
  });

  const approved: T = {
    ...state,
    stage: "senior_approved",
    audit: [...state.audit, auditEvent(state, {
      event_type: "batch.senior_approved",
      actor_id: actor.id,
      actor_role: actor.role,
      entity_type: "publication_batch",
      entity_id: "pub-cobalt-jul-v2",
      occurred_at: occurredAt,
      metadata: { candidate_count: state.candidates.length },
    })],
  };
  assertTransition(approved.stage, "published");

  const publishDate = state.effective_date;
  const previousDay = new Date(`${publishDate}T00:00:00.000Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const priorValidTo = previousDay.toISOString().slice(0, 10);
  const predecessorIds = new Set(state.candidates.map((candidate) => candidate.predecessor_version_id));
  const candidateVersionIds = new Set(state.candidates.map((candidate) => candidate.candidate_version_id));
  const supersede = <V extends VersionedRecord>(items: readonly V[]): V[] => items.map((item) => {
    if (predecessorIds.has(item.id)) {
      return { ...item, status: "superseded", superseded: true, valid_to: priorValidTo };
    }
    if (candidateVersionIds.has(item.id)) {
      return { ...item, status: "published", superseded: false, valid_from: publishDate, valid_to: null };
    }
    return { ...item };
  });

  return {
    ...approved,
    revision: state.revision + 1,
    stage: "published",
    candidates: approved.candidates.map((candidate) => ({ ...candidate, status: "published" as const })),
    records: supersede(approved.records),
    files: supersede(approved.files),
    audit: [...approved.audit, auditEvent(approved, {
      event_type: "batch.published",
      actor_id: actor.id,
      actor_role: actor.role,
      entity_type: "publication_batch",
      entity_id: "pub-cobalt-jul-v2",
      occurred_at: occurredAt,
      metadata: { superseded_version: 1, published_version: 2 },
    })],
  };
}

export interface RecipientGroup {
  to: Array<{email: string; role: string}>;
  cc: Array<{email: string; role: string}>;
}

export function validateLandlordRecipients(group: RecipientGroup): RecipientGroup {
  const toRoles = new Set(group.to.map((item) => item.role));
  const ccRoles = new Set(group.cc.map((item) => item.role));
  if (!toRoles.has("to_landlord_practical")) {
    throw new Error("A landlord practical owner is required in To.");
  }
  for (const required of [
    "cc_landlord_team",
    "cc_landlord_exec",
    "cc_lm_team",
    "cc_lm_exec",
  ]) {
    if (!ccRoles.has(required)) throw new Error(`Missing required Cc role: ${required}`);
  }
  return group;
}

export function canSendExternal(input: {
  approved: boolean;
  unresolvedCount: number;
  facts: readonly VersionedRecord[];
  files: readonly VersionedRecord[];
}): boolean {
  if (!input.approved || input.unresolvedCount > 0) return false;
  return [...input.facts, ...input.files].every(
    (item) => item.status === "published" && !item.superseded && item.external_shareable,
  );
}

export const REQUESTED_FIELDS = ["marketed_area", "rent_free", "supported_parking"] as const;
export const REQUESTED_FILES = ["current_floor_plan"] as const;
export type RequestedField = (typeof REQUESTED_FIELDS)[number];
export type RequestedFile = (typeof REQUESTED_FILES)[number];

export interface OperationalRequestExtraction {
  language: "ko" | "en" | "mixed";
  building_mentions: Array<{ text: string; resolved_building_id: string | null; confidence: number }>;
  floor: string | null;
  requested_fields: RequestedField[];
  requested_files: RequestedFile[];
  recipient: { name: string | null; organization: string | null };
  deadline: string | null;
  ambiguities: Array<{ field: string; reason: string }>;
}

export interface OperationalRequest {
  id: string;
  source: "call" | "email";
  source_id: string;
  raw_text: string;
  extraction: OperationalRequestExtraction;
  status: "candidate" | "confirmed";
  imported_at: string;
  confirmed_at: string | null;
}

export interface PackageFact {
  field: RequestedField;
  label: string;
  value: number;
  unit: "py" | "months" | "spaces";
  version_id: string;
  source_pointer: string;
}

export interface PackageFile {
  requested_file: RequestedFile;
  filename: string;
  version_id: string;
  source_pointer: string;
}

export interface OperationalPackage {
  id: string;
  request_id: string;
  building_id: string;
  floor: string;
  status: "draft" | "edit_pending" | "approved" | "sent" | "stale";
  subject: string;
  body: string;
  facts: PackageFact[];
  files: PackageFile[];
  recipients: { to: string[]; cc: string[]; configuration_id: string };
  unresolved: string[];
  edit_candidate: { subject: string; body: string; instruction: string } | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  idempotency_key: string | null;
}

export interface OperationalActivity {
  id: string;
  event_type: "package.sent.sandbox";
  package_id: string;
  building_id: string;
  occurred_at: string;
  summary: string;
}

export interface OperationalAuditEvent {
  id: string;
  event_type:
    | "request.imported"
    | "request.confirmed"
    | "package.drafted"
    | "package.edit_proposed"
    | "package.edit_accepted"
    | "package.edit_rejected"
    | "package.approved"
    | "package.sent.sandbox";
  actor_id: string;
  actor_role: UserRole;
  entity_id: string;
  occurred_at: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface OperationalState {
  requests: OperationalRequest[];
  packages: OperationalPackage[];
  activities: OperationalActivity[];
  audit: OperationalAuditEvent[];
}

export interface DraftMaterial {
  building_id: string;
  building_name: string;
  floor: string;
  facts: PackageFact[];
  files: PackageFile[];
}

export type PackageMessageTone = "neutral" | "concise_courteous" | "formal";

export function renderProtectedPackageMaterial(
  facts: readonly PackageFact[],
  files: readonly PackageFile[],
): string {
  return [
    "--- PROTECTED PUBLISHED MATERIAL ---",
    ...facts.map((fact) => `${fact.label}: ${fact.value} ${fact.unit} | version=${fact.version_id} | source=${fact.source_pointer}`),
    ...files.map((file) => `Attachment: ${file.filename} | version=${file.version_id} | source=${file.source_pointer}`),
    "--- END PROTECTED PUBLISHED MATERIAL ---",
  ].join("\n");
}

export function renderOperationalPackageBody(
  facts: readonly PackageFact[],
  files: readonly PackageFile[],
  tone: PackageMessageTone,
): string {
  const copy = {
    neutral: ["Current published leasing information is provided below.", "Please review the attached current floor plan."],
    concise_courteous: ["Hello, please find the current published leasing information below.", "Thank you."],
    formal: ["Please find below the currently published and authorized leasing information.", "Kind regards,\nLeaseFlow Demo"],
  } as const;
  return `${copy[tone][0]}\n\n${renderProtectedPackageMaterial(facts, files)}\n\n${copy[tone][1]}`;
}

export function assertOperationalPackageContentIntegrity(pkg: OperationalPackage): void {
  const allowedBodies = (["neutral", "concise_courteous", "formal"] as const)
    .map((tone) => renderOperationalPackageBody(pkg.facts, pkg.files, tone));
  if (!allowedBodies.includes(pkg.body)) {
    throw new Error("Package protected published material was altered or unapproved factual content was introduced.");
  }
  if (pkg.edit_candidate) {
    if (pkg.edit_candidate.subject !== pkg.subject || !allowedBodies.includes(pkg.edit_candidate.body)) {
      throw new Error("Package edit attempted to alter protected subject or published material.");
    }
  }
}

export function createInitialOperationalState(): OperationalState {
  return { requests: [], packages: [], activities: [], audit: [] };
}

function operationalAudit(
  state: OperationalState,
  event: Omit<OperationalAuditEvent, "id">,
): OperationalAuditEvent {
  return { ...event, id: `op-audit-${state.audit.length + 1}` };
}

function requireOperationalActor(actor: { id: string; role: UserRole }, action: string): void {
  if (!canPerform(actor.role, action)) throw new Error(`Role ${actor.role} is not allowed to perform ${action}.`);
}

export function importOperationalRequest(
  state: OperationalState,
  input: Omit<OperationalRequest, "status" | "imported_at" | "confirmed_at">,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): OperationalState {
  requireOperationalActor(actor, "package.prepare");
  if (state.requests.some((request) => request.id === input.id)) throw new Error(`Request ${input.id} already exists.`);
  const request: OperationalRequest = { ...input, status: "candidate", imported_at: occurredAt, confirmed_at: null };
  return {
    ...state,
    requests: [...state.requests, request],
    audit: [...state.audit, operationalAudit(state, {
      event_type: "request.imported", actor_id: actor.id, actor_role: actor.role,
      entity_id: request.id, occurred_at: occurredAt, metadata: { source: request.source },
    })],
  };
}

export function confirmOperationalRequest(
  state: OperationalState,
  requestId: string,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): OperationalState {
  requireOperationalActor(actor, "package.prepare");
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) throw new Error(`Unknown request: ${requestId}.`);
  if (request.extraction.ambiguities.length > 0
    || !request.extraction.floor
    || request.extraction.building_mentions.length !== 1
    || !request.extraction.building_mentions[0]?.resolved_building_id) {
    throw new Error("Request confirmation is blocked until all ambiguities are resolved.");
  }
  return {
    ...state,
    requests: state.requests.map((item) => item.id === requestId
      ? { ...item, status: "confirmed" as const, confirmed_at: occurredAt }
      : item),
    audit: [...state.audit, operationalAudit(state, {
      event_type: "request.confirmed", actor_id: actor.id, actor_role: actor.role,
      entity_id: requestId, occurred_at: occurredAt, metadata: {},
    })],
  };
}

export function draftOperationalPackage(
  state: OperationalState,
  requestId: string,
  material: DraftMaterial,
  recipients: OperationalPackage["recipients"],
  actor: { id: string; role: UserRole },
  occurredAt: string,
): OperationalState {
  requireOperationalActor(actor, "package.prepare");
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "confirmed") throw new Error("Only a confirmed request can be drafted.");
  if (state.packages.some((item) => item.request_id === requestId)) throw new Error("A package already exists for this request.");
  const resolved = request.extraction.building_mentions[0]?.resolved_building_id;
  if (resolved !== material.building_id || request.extraction.floor !== material.floor) {
    throw new Error("Published material does not match the confirmed request scope.");
  }
  const facts = request.extraction.requested_fields.map((field) => {
    const fact = material.facts.find((item) => item.field === field);
    if (!fact) throw new Error(`No current published fact is available for ${field}.`);
    return fact;
  });
  const files = request.extraction.requested_files.map((requestedFile) => {
    const file = material.files.find((item) => item.requested_file === requestedFile);
    if (!file) throw new Error(`No current published file is available for ${requestedFile}.`);
    return file;
  });
  if (recipients.to.length === 0) throw new Error("Configured package recipients require at least one To address.");
  const packageId = `pkg-${request.id}`;
  const packageDraft: OperationalPackage = {
    id: packageId, request_id: request.id, building_id: material.building_id, floor: material.floor,
    status: "draft", subject: `[LeaseFlow] ${material.building_name} ${material.floor} leasing package`,
    body: renderOperationalPackageBody(facts, files, "neutral"),
    facts, files, recipients, unresolved: [], edit_candidate: null,
    approved_by: null, approved_at: null, sent_at: null, idempotency_key: null,
  };
  return {
    ...state,
    packages: [...state.packages, packageDraft],
    audit: [...state.audit, operationalAudit(state, {
      event_type: "package.drafted", actor_id: actor.id, actor_role: actor.role,
      entity_id: packageId, occurred_at: occurredAt, metadata: { fact_count: facts.length, file_count: files.length },
    })],
  };
}

export function proposePackageEdit(
  state: OperationalState,
  packageId: string,
  edit: { subject: string; body: string; instruction: string },
  actor: { id: string; role: UserRole },
  occurredAt: string,
): OperationalState {
  requireOperationalActor(actor, "package.prepare");
  const target = state.packages.find((item) => item.id === packageId);
  if (!target || target.status !== "draft") throw new Error("Only a draft package can receive an edit candidate.");
  assertOperationalPackageContentIntegrity({ ...target, edit_candidate: edit });
  return {
    ...state,
    packages: state.packages.map((item) => item.id === packageId
      ? { ...item, status: "edit_pending" as const, edit_candidate: { ...edit } }
      : item),
    audit: [...state.audit, operationalAudit(state, {
      event_type: "package.edit_proposed", actor_id: actor.id, actor_role: actor.role,
      entity_id: packageId, occurred_at: occurredAt, metadata: { instruction: edit.instruction },
    })],
  };
}

export function decidePackageEdit(
  state: OperationalState,
  packageId: string,
  decision: "accept" | "reject",
  actor: { id: string; role: UserRole },
  occurredAt: string,
): OperationalState {
  requireOperationalActor(actor, "package.prepare");
  const target = state.packages.find((item) => item.id === packageId);
  if (!target || target.status !== "edit_pending" || !target.edit_candidate) throw new Error("No edit candidate is pending.");
  assertOperationalPackageContentIntegrity(target);
  return {
    ...state,
    packages: state.packages.map((item) => item.id !== packageId ? item : {
      ...item, status: "draft" as const,
      subject: decision === "accept" ? target.edit_candidate!.subject : item.subject,
      body: decision === "accept" ? target.edit_candidate!.body : item.body,
      edit_candidate: null,
    }),
    audit: [...state.audit, operationalAudit(state, {
      event_type: decision === "accept" ? "package.edit_accepted" : "package.edit_rejected",
      actor_id: actor.id, actor_role: actor.role, entity_id: packageId, occurred_at: occurredAt, metadata: {},
    })],
  };
}

export function approveOperationalPackage(
  state: OperationalState,
  packageId: string,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): OperationalState {
  requireOperationalActor(actor, "package.approve");
  const target = state.packages.find((item) => item.id === packageId);
  if (!target || target.status !== "draft" || target.unresolved.length > 0) throw new Error("Only a complete draft package can be approved.");
  assertOperationalPackageContentIntegrity(target);
  return {
    ...state,
    packages: state.packages.map((item) => item.id === packageId
      ? { ...item, status: "approved" as const, approved_by: actor.id, approved_at: occurredAt }
      : item),
    audit: [...state.audit, operationalAudit(state, {
      event_type: "package.approved", actor_id: actor.id, actor_role: actor.role,
      entity_id: packageId, occurred_at: occurredAt, metadata: {},
    })],
  };
}

export function sendOperationalPackage(
  state: OperationalState,
  packageId: string,
  idempotencyKey: string,
  currentVersionIds: ReadonlySet<string>,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): OperationalState {
  requireOperationalActor(actor, "package.send");
  const reusedKey = state.packages.find((item) => item.idempotency_key === idempotencyKey && item.id !== packageId);
  if (reusedKey) throw new Error("Idempotency key is already assigned to another package.");
  const target = state.packages.find((item) => item.id === packageId);
  if (!target) throw new Error(`Unknown package: ${packageId}.`);
  assertOperationalPackageContentIntegrity(target);
  if (target.status === "sent" && target.idempotency_key === idempotencyKey) return state;
  if (target.status !== "approved") throw new Error("Package send is blocked until LM Manager approval.");
  const referencedIds = [...target.facts.map((fact) => fact.version_id), ...target.files.map((file) => file.version_id)];
  if (referencedIds.some((id) => !currentVersionIds.has(id))) {
    throw new Error("Package send is blocked because a referenced published version is stale.");
  }
  const activity: OperationalActivity = {
    id: `activity-${state.activities.length + 1}`, event_type: "package.sent.sandbox",
    package_id: packageId, building_id: target.building_id, occurred_at: occurredAt,
    summary: `Sandbox package sent to ${target.recipients.to.join(", ")}.`,
  };
  return {
    ...state,
    packages: state.packages.map((item) => item.id === packageId
      ? { ...item, status: "sent" as const, sent_at: occurredAt, idempotency_key: idempotencyKey }
      : item),
    activities: [...state.activities, activity],
    audit: [...state.audit, operationalAudit(state, {
      event_type: "package.sent.sandbox", actor_id: actor.id, actor_role: actor.role,
      entity_id: packageId, occurred_at: occurredAt, metadata: { idempotency_key: idempotencyKey },
    })],
  };
}
