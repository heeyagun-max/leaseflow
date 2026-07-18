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

  return eligible.sort((a, b) => b.version_no - a.version_no)[0] ?? null;
}

export function requireExternalRecord<T extends VersionedRecord>(record: T | null): T {
  if (!record) throw new Error("No current published record is available.");
  if (!record.external_shareable) {
    throw new Error("The current record is not approved for external sharing.");
  }
  return record;
}

export function selectCurrentFloorPlan(
  files: readonly FileVersion[],
  buildingId: string,
  floor: string,
  asOf = new Date(),
): FileVersion {
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
