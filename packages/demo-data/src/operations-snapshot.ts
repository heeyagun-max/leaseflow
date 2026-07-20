import type { MobilePublishedSnapshot } from "./index";
import {
  SOURCE_DOCUMENT_TYPES,
  type PublishedDocumentReference,
} from "@leaseflow/domain";

export interface PublicRevisionedProjection {
  revision: number;
  publication_stage: string;
}

export interface PublicPackageWorkflowProjection extends PublicRevisionedProjection {
  requests: readonly unknown[];
  packages: readonly unknown[];
  activities: readonly unknown[];
  audit: readonly unknown[];
}

export interface PublicReportWorkflowProjection extends PublicRevisionedProjection {
  reports: readonly unknown[];
  activities: readonly unknown[];
  audit: readonly unknown[];
}

export interface PublicOperationsSnapshot<
  TWorkflow extends PublicPackageWorkflowProjection = PublicPackageWorkflowProjection,
  TReports extends PublicReportWorkflowProjection = PublicReportWorkflowProjection,
> {
  snapshot_version: 1;
  revision: number;
  publication_stage: string;
  scope: { building_ids: string[] };
  published: MobilePublishedSnapshot;
  published_documents: PublishedDocumentReference[];
  workflow: TWorkflow;
  reports: TReports;
}

const forbiddenPublicKeys = new Set([
  "actor_id",
  "actor_role",
  "approved_by",
  "candidate_summary",
  "candidate_text",
  "content_fingerprint",
  "idempotency_key",
  "metadata",
  "protected_snapshot",
  "raw_text",
  "reviewed_at",
  "reviewed_by",
  "reviewer",
  "source_id",
  "stored_filename",
  "synthetic_fingerprint",
]);

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireRevision(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value as number;
}

function assertPublicKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertPublicKeys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPublicKeys.has(key)) throw new Error(`Operations snapshot contains forbidden public field: ${key}.`);
    assertPublicKeys(child);
  }
}

const publishedDocumentKeys = new Set([
  "building_id",
  "document_type",
  "reviewed_summary",
]);

function parsePublishedDocuments(
  value: unknown,
  authorizedBuildingIds: readonly string[],
): PublishedDocumentReference[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("published_documents must be an array.");
  const allowedBuildings = new Set(authorizedBuildingIds);
  return value.map((entry, index) => {
    const document = requireObject(entry, `published_documents[${index}]`);
    assertPublicKeys(document);
    for (const key of Object.keys(document)) {
      if (!publishedDocumentKeys.has(key)) {
        throw new Error(`Operations snapshot contains forbidden public field: ${key}.`);
      }
    }
    if (typeof document.building_id !== "string" || !document.building_id) {
      throw new Error(`published_documents[${index}].building_id is required.`);
    }
    if (!allowedBuildings.has(document.building_id)) {
      throw new Error("Published document is outside the authorized building scope.");
    }
    if (typeof document.document_type !== "string"
      || !(SOURCE_DOCUMENT_TYPES as readonly string[]).includes(document.document_type)) {
      throw new Error(`published_documents[${index}].document_type is invalid.`);
    }
    if (typeof document.reviewed_summary !== "string" || !document.reviewed_summary.trim()) {
      throw new Error(`published_documents[${index}].reviewed_summary is required.`);
    }
    return {
      building_id: document.building_id,
      document_type: document.document_type as PublishedDocumentReference["document_type"],
      reviewed_summary: document.reviewed_summary,
    };
  });
}

export function createPublicOperationsSnapshot<
  TWorkflow extends PublicPackageWorkflowProjection,
  TReports extends PublicReportWorkflowProjection,
>(input: {
  authorized_building_ids: readonly string[];
  published: MobilePublishedSnapshot;
  published_documents?: readonly PublishedDocumentReference[];
  workflow: TWorkflow;
  reports: TReports;
}): PublicOperationsSnapshot<TWorkflow, TReports> {
  const revision = input.published.revision;
  if (input.workflow.revision !== revision || input.reports.revision !== revision) {
    throw new Error("Operations snapshot projections must share one canonical revision.");
  }
  if (input.workflow.publication_stage !== input.published.publication_stage
    || input.reports.publication_stage !== input.published.publication_stage) {
    throw new Error("Operations snapshot projections must share one publication stage.");
  }
  if (!input.authorized_building_ids.includes(input.published.building_id)) {
    throw new Error(`Operations snapshot building is not authorized: ${input.published.building_id}.`);
  }
  const publishedDocuments = parsePublishedDocuments(
    input.published_documents,
    input.authorized_building_ids,
  );
  const snapshot: PublicOperationsSnapshot<TWorkflow, TReports> = {
    snapshot_version: 1,
    revision,
    publication_stage: input.published.publication_stage,
    scope: { building_ids: [...input.authorized_building_ids] },
    published: input.published,
    published_documents: publishedDocuments,
    workflow: input.workflow,
    reports: input.reports,
  };
  assertPublicKeys(snapshot);
  return snapshot;
}

export function parsePublicOperationsSnapshot<
  TWorkflow extends PublicPackageWorkflowProjection,
  TReports extends PublicReportWorkflowProjection,
>(value: unknown): PublicOperationsSnapshot<TWorkflow, TReports> {
  const snapshot = requireObject(value, "Operations snapshot");
  if (snapshot.snapshot_version !== 1) throw new Error("Unsupported operations snapshot version.");
  const revision = requireRevision(snapshot.revision, "Operations snapshot revision");
  if (typeof snapshot.publication_stage !== "string") throw new Error("Operations snapshot publication stage is required.");
  const scope = requireObject(snapshot.scope, "Operations snapshot scope");
  if (!Array.isArray(scope.building_ids) || scope.building_ids.some((id) => typeof id !== "string")) {
    throw new Error("Operations snapshot building scope is invalid.");
  }
  const published = requireObject(snapshot.published, "Published projection");
  const workflow = requireObject(snapshot.workflow, "Package workflow projection");
  const reports = requireObject(snapshot.reports, "Report workflow projection");
  for (const [label, projection] of [["published", published], ["workflow", workflow], ["reports", reports]] as const) {
    if (requireRevision(projection.revision, `${label} revision`) !== revision) {
      throw new Error("Operations snapshot projections do not share the canonical revision.");
    }
    if (projection.publication_stage !== snapshot.publication_stage) {
      throw new Error("Operations snapshot projections do not share the canonical publication stage.");
    }
  }
  if (!scope.building_ids.includes(published.building_id)) {
    throw new Error("Published projection is outside the authorized building scope.");
  }
  const publishedDocuments = parsePublishedDocuments(snapshot.published_documents, scope.building_ids as string[]);
  for (const [label, projection, keys] of [
    ["workflow", workflow, ["requests", "packages", "activities", "audit"]],
    ["reports", reports, ["reports", "activities", "audit"]],
  ] as const) {
    for (const key of keys) if (!Array.isArray(projection[key])) throw new Error(`${label}.${key} must be an array.`);
  }
  assertPublicKeys(snapshot);
  return {
    ...snapshot,
    published_documents: publishedDocuments,
  } as unknown as PublicOperationsSnapshot<TWorkflow, TReports>;
}
