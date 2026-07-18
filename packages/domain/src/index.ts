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
    lm_manager: ["package.prepare", "package.approve", "report.approve"],
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
