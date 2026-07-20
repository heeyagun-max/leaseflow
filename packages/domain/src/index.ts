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

export const ASSET_DOCUMENT_CATEGORIES = [
  "perspective_render",
  "building_flyer",
  "portfolio_flyer",
  "floor_plan",
  "area_workbook",
  "legal_document",
] as const;

export type AssetDocumentCategory = (typeof ASSET_DOCUMENT_CATEGORIES)[number];
export type AssetConfidentiality = "internal" | "restricted" | "legal_restricted" | "public_candidate";
export type AssetLifecycleStatus = "registered" | "steward_confirmed" | "published" | "superseded" | "duplicate" | "rejected";
export type AssetClassificationState = "candidate" | "confirmed" | "manual_review";
export type AssetExtractionState = "not_started" | "candidate_ready" | "unsupported" | "reviewed";

export const SOURCE_DOCUMENT_TYPES = [
  "monthly_owner_update",
  "floor_plan",
  "leasing_flyer",
  "area_workbook",
  "legal_document",
] as const;

export type SourceDocumentType = (typeof SOURCE_DOCUMENT_TYPES)[number];

export const SOURCE_DOCUMENT_FORMATS = [
  "json",
  "pdf",
  "xlsx",
  "docx",
  "svg",
  "dwg",
  "dxf",
  "other",
] as const;

export type SourceDocumentFormat = (typeof SOURCE_DOCUMENT_FORMATS)[number];
export type SourceDocumentOrigin = "synthetic_seed" | "ephemeral_private_qa";
export type DocumentReviewPolicy = "publishable_reference" | "review_only" | "manual_review";

export interface AssetAuditProvenance {
  event: "registered" | "filename_observed" | "classified" | "steward_confirmed" | "reviewed" | "published" | "superseded";
  actor_id: string;
  occurred_at: string;
  details: Record<string, unknown>;
}

export interface GovernedSourceAsset {
  id: string;
  observed_filenames: string[];
  synthetic_fingerprint: string | null;
  content_fingerprint: string;
  mime_type: string;
  extension: string;
  byte_size: number;
  building_id: string | null;
  building_alias_candidate: string | null;
  source_organization: string;
  document_category: AssetDocumentCategory;
  document_type: SourceDocumentType;
  source_format: SourceDocumentFormat;
  source_origin: SourceDocumentOrigin;
  review_policy: DocumentReviewPolicy;
  reviewed_summary: string | null;
  artifact_date: string | null;
  effective_date: string | null;
  confidentiality: AssetConfidentiality;
  externally_shareable: boolean;
  status: AssetLifecycleStatus;
  classification_state: AssetClassificationState;
  version_family: string;
  segmentation_marker: string | null;
  linked_file_version_id: string | null;
  duplicate_of: string | null;
  supersedes: string | null;
  extraction_method: "deterministic_metadata" | "text_candidate" | "manual";
  extraction_state: AssetExtractionState;
  review_decision: "pending" | "confirmed" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  active: boolean;
  authorized: boolean;
  audit_provenance: AssetAuditProvenance[];
}

export interface GovernedAssetRegistry {
  assets: GovernedSourceAsset[];
}

export interface RegisterSourceAssetInput {
  id: string;
  observed_filename: string;
  synthetic_fingerprint: string;
  mime_type: string;
  byte_size: number;
  building_alias_candidate: string | null;
  building_id: string | null;
  source_organization: string;
  linked_file_version_id?: string | null;
  occurred_at: string;
  document_type?: SourceDocumentType;
  source_format?: SourceDocumentFormat;
  content_fingerprint?: string;
  source_origin?: SourceDocumentOrigin;
  review_policy?: DocumentReviewPolicy;
  reviewed_summary?: null;
  has_extractable_text?: boolean;
}

export interface RegisterDocumentAssetInput {
  id?: string;
  document_id?: string;
  observed_filename: string;
  content_fingerprint: string;
  synthetic_fingerprint?: string | null;
  mime_type: string;
  byte_size: number;
  building_alias_candidate: string | null;
  building_id: string | null;
  source_organization: string;
  document_type: SourceDocumentType;
  source_format: SourceDocumentFormat;
  source_origin: SourceDocumentOrigin;
  linked_file_version_id?: string | null;
  has_extractable_text?: boolean;
  review_policy?: DocumentReviewPolicy;
  reviewed_summary?: null;
  actor?: { id: string; role: UserRole };
  occurred_at: string;
}

export interface PublishedDocumentReference {
  building_id: string;
  document_type: SourceDocumentType;
  reviewed_summary: string;
}

const restrictedAssetCategories = new Set<AssetDocumentCategory>(["area_workbook", "legal_document"]);
const forbiddenPersistedDocumentInputKeys = new Set([
  "raw_bytes",
  "raw_text",
  "normalized_text",
  "private_asset_path",
]);

function filenameArtifactDate(filename: string): string | null {
  const compact = filename.match(/(?:^|[^0-9])(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?([0-2]\d|3[01])(?:[^0-9]|$)/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : null;
}

function classifyAssetFilename(filename: string): {
  category: AssetDocumentCategory;
  confidentiality: AssetConfidentiality;
  versionFamily: string;
  segmentationMarker: string | null;
} {
  const lower = filename.toLowerCase();
  const stem = lower.replace(/\.[^.]+$/, "").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
  const date = filenameArtifactDate(filename);
  if (/portfolio|포트폴리오/.test(lower)) {
    return {
      category: "portfolio_flyer",
      confidentiality: "public_candidate",
      versionFamily: `portfolio-edition:${date ?? stem}`,
      segmentationMarker: "portfolio-wide",
    };
  }
  if (/legal|contract|agreement|계약|법무/.test(lower)) {
    return { category: "legal_document", confidentiality: "legal_restricted", versionFamily: `legal:${stem}`, segmentationMarker: null };
  }
  if (/area|면적|rent[_ -]?roll/.test(lower) || /\.xlsx?$/.test(lower)) {
    return { category: "area_workbook", confidentiality: "restricted", versionFamily: `workbook:${stem.replace(/-v\d+$/, "")}`, segmentationMarker: null };
  }
  if (/plan|도면/.test(lower) || /\.(dwg|dxf)$/.test(lower)) {
    const planFamily = stem.replace(/-20\d{6}$/, "").replace(/-v?\d+$/, "");
    return { category: "floor_plan", confidentiality: "public_candidate", versionFamily: `floor-plan:${planFamily}`, segmentationMarker: null };
  }
  if (/render|perspective|perspetive|투시도/.test(lower)) {
    return { category: "perspective_render", confidentiality: "public_candidate", versionFamily: `render:${stem}`, segmentationMarker: null };
  }
  const flyerFamily = stem.replace(/-20\d{4}(?:\d{2})?$/, "").replace(/-v?\d+$/, "");
  return { category: "building_flyer", confidentiality: "public_candidate", versionFamily: `building-flyer:${flyerFamily}`, segmentationMarker: "single-building" };
}

function sourceFormatFromFilename(filename: string): SourceDocumentFormat {
  const extension = filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? "";
  return (SOURCE_DOCUMENT_FORMATS as readonly string[]).includes(extension)
    ? extension as SourceDocumentFormat
    : "other";
}

function documentTypeFromClassification(
  filename: string,
  category: AssetDocumentCategory,
): SourceDocumentType {
  if (/monthly[^a-z0-9]*owner|owner[^a-z0-9]*update|월간.*임대/i.test(filename)) return "monthly_owner_update";
  if (category === "floor_plan") return "floor_plan";
  if (category === "area_workbook") return "area_workbook";
  if (category === "legal_document") return "legal_document";
  return "leasing_flyer";
}

function categoryForDocumentType(
  documentType: SourceDocumentType,
  classifiedCategory: AssetDocumentCategory,
): AssetDocumentCategory {
  if (documentType === "floor_plan") return "floor_plan";
  if (documentType === "area_workbook") return "area_workbook";
  if (documentType === "legal_document") return "legal_document";
  if (documentType === "leasing_flyer"
    && (classifiedCategory === "portfolio_flyer" || classifiedCategory === "perspective_render")) {
    return classifiedCategory;
  }
  return "building_flyer";
}

function confidentialityForCategory(category: AssetDocumentCategory): AssetConfidentiality {
  if (category === "legal_document") return "legal_restricted";
  if (category === "area_workbook") return "restricted";
  return "public_candidate";
}

export function resolveDocumentReviewPolicy(input: {
  document_type: SourceDocumentType;
  source_format: SourceDocumentFormat;
  has_extractable_text?: boolean;
}): DocumentReviewPolicy {
  if (input.source_format === "dwg" || input.source_format === "dxf" || input.has_extractable_text === false) {
    return "manual_review";
  }
  if (input.document_type === "legal_document" || input.document_type === "area_workbook") return "review_only";
  return "publishable_reference";
}

function requireDocumentId(input: { id?: string; document_id?: string }): string {
  const ids = [input.id, input.document_id].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (ids.length !== 1) throw new Error("Document registration requires exactly one document id.");
  return ids[0]!;
}

function requireContentFingerprint(value: string): string {
  if (!/^(?:sha256|synthetic):[^\s]+$/.test(value)) {
    throw new Error("Document content fingerprint must use a sha256: or synthetic: prefix.");
  }
  return value;
}

function assertNoRawDocumentContent(input: object): void {
  for (const key of Object.keys(input)) {
    if (forbiddenPersistedDocumentInputKeys.has(key)) {
      throw new Error(`Document registration cannot persist ${key}.`);
    }
  }
}

export function registerDocumentAsset(
  registry: GovernedAssetRegistry,
  input: RegisterDocumentAssetInput,
): GovernedAssetRegistry {
  assertNoRawDocumentContent(input);
  if (input.actor) requireAction(input.actor.role, "source.upload");
  if (input.byte_size < 0 || !Number.isSafeInteger(input.byte_size)) {
    throw new Error("Asset byte size must be a non-negative integer.");
  }
  if (input.reviewed_summary !== undefined && input.reviewed_summary !== null) {
    throw new Error("A reviewed summary can only be accepted by the review action.");
  }

  const id = requireDocumentId(input);
  const contentFingerprint = requireContentFingerprint(input.content_fingerprint);
  const existing = registry.assets.find((asset) => asset.content_fingerprint === contentFingerprint);
  if (existing) {
    if (existing.building_id !== input.building_id
      || existing.document_type !== input.document_type
      || existing.source_organization !== input.source_organization) {
      throw new Error("Matching document content is already registered with different building or governance metadata.");
    }
    const observed = existing.observed_filenames.includes(input.observed_filename)
      ? existing.observed_filenames
      : [...existing.observed_filenames, input.observed_filename];
    return {
      assets: registry.assets.map((asset) => asset.id === existing.id ? {
        ...asset,
        observed_filenames: observed,
        audit_provenance: observed === existing.observed_filenames ? asset.audit_provenance : [...asset.audit_provenance, {
          event: "filename_observed",
          actor_id: input.actor?.id ?? "system",
          occurred_at: input.occurred_at,
          details: { observed_filename: input.observed_filename },
        }],
      } : asset),
    };
  }
  if (registry.assets.some((asset) => asset.id === id)) throw new Error(`Duplicate source asset id: ${id}.`);

  const extension = input.observed_filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? "";
  const classification = classifyAssetFilename(input.observed_filename);
  const documentCategory = categoryForDocumentType(input.document_type, classification.category);
  const resolvedReviewPolicy = resolveDocumentReviewPolicy(input);
  const reviewPolicy = input.review_policy === "manual_review"
    ? "manual_review"
    : input.document_type === "floor_plan" && input.review_policy === "review_only"
      ? "review_only"
      : resolvedReviewPolicy;
  if (input.review_policy !== undefined && input.review_policy !== reviewPolicy) {
    throw new Error(`Document review policy must be ${reviewPolicy}.`);
  }
  const manualReview = reviewPolicy === "manual_review";
  const asset: GovernedSourceAsset = {
    id,
    observed_filenames: [input.observed_filename],
    synthetic_fingerprint: input.synthetic_fingerprint ?? null,
    content_fingerprint: contentFingerprint,
    mime_type: input.mime_type,
    extension,
    byte_size: input.byte_size,
    building_id: input.building_id,
    building_alias_candidate: input.building_alias_candidate,
    source_organization: input.source_organization,
    document_category: documentCategory,
    document_type: input.document_type,
    source_format: input.source_format,
    source_origin: input.source_origin,
    review_policy: reviewPolicy,
    reviewed_summary: null,
    artifact_date: filenameArtifactDate(input.observed_filename),
    effective_date: null,
    confidentiality: confidentialityForCategory(documentCategory),
    externally_shareable: false,
    status: "registered",
    classification_state: manualReview ? "manual_review" : "candidate",
    version_family: classification.versionFamily,
    segmentation_marker: classification.segmentationMarker,
    linked_file_version_id: input.linked_file_version_id ?? null,
    duplicate_of: null,
    supersedes: null,
    extraction_method: manualReview ? "manual" : "deterministic_metadata",
    extraction_state: manualReview ? "unsupported" : "candidate_ready",
    review_decision: "pending",
    reviewed_by: null,
    reviewed_at: null,
    active: false,
    authorized: false,
    audit_provenance: [
      {
        event: "registered",
        actor_id: input.actor?.id ?? "system",
        occurred_at: input.occurred_at,
        details: { source_organization: input.source_organization, source_origin: input.source_origin },
      },
      {
        event: "classified",
        actor_id: "system",
        occurred_at: input.occurred_at,
        details: { candidate_only: true, review_policy: reviewPolicy },
      },
    ],
  };
  return { assets: [...registry.assets, asset] };
}

export function registerSourceAsset(
  registry: GovernedAssetRegistry,
  input: RegisterSourceAssetInput,
): GovernedAssetRegistry {
  if (!input.synthetic_fingerprint.startsWith("synthetic:")) {
    throw new Error("Only synthetic asset fingerprints are accepted in demo mode.");
  }
  const classification = classifyAssetFilename(input.observed_filename);
  return registerDocumentAsset(registry, {
    id: input.id,
    observed_filename: input.observed_filename,
    content_fingerprint: input.content_fingerprint ?? input.synthetic_fingerprint,
    synthetic_fingerprint: input.synthetic_fingerprint,
    mime_type: input.mime_type,
    byte_size: input.byte_size,
    building_alias_candidate: input.building_alias_candidate,
    building_id: input.building_id,
    source_organization: input.source_organization,
    occurred_at: input.occurred_at,
    document_type: input.document_type ?? documentTypeFromClassification(input.observed_filename, classification.category),
    source_format: input.source_format ?? sourceFormatFromFilename(input.observed_filename),
    source_origin: input.source_origin ?? "synthetic_seed",
    ...(input.linked_file_version_id !== undefined ? { linked_file_version_id: input.linked_file_version_id } : {}),
    ...(input.review_policy !== undefined ? { review_policy: input.review_policy } : {}),
    ...(input.reviewed_summary !== undefined ? { reviewed_summary: input.reviewed_summary } : {}),
    ...(input.has_extractable_text !== undefined ? { has_extractable_text: input.has_extractable_text } : {}),
  });
}

export function confirmSourceAsset(
  registry: GovernedAssetRegistry,
  input: {
    asset_id: string;
    building_id: string;
    externally_shareable: boolean;
    reviewed_summary?: string | null;
    actor: { id: string; role: UserRole };
    occurred_at: string;
  },
): GovernedAssetRegistry {
  requireAction(input.actor.role, "candidate.confirm");
  const target = registry.assets.find((asset) => asset.id === input.asset_id);
  if (!target) throw new Error(`Unknown source asset: ${input.asset_id}.`);
  if (target.status !== "registered" || target.classification_state !== "candidate") {
    throw new Error("Only supported classification candidates can be confirmed.");
  }
  if (!target.building_id || !target.building_alias_candidate) throw new Error("Unresolved building alias blocks confirmation.");
  if (target.building_id !== input.building_id) throw new Error("Wrong-building confirmation is blocked.");
  if (input.externally_shareable && restrictedAssetCategories.has(target.document_category)) {
    throw new Error("Restricted legal or workbook sources cannot be made externally shareable by classification.");
  }
  const reviewedSummary = input.reviewed_summary == null ? null : normalizeReviewedSummary(input.reviewed_summary);
  return {
    assets: registry.assets.map((asset) => asset.id === target.id ? {
      ...asset,
      externally_shareable: input.externally_shareable,
      status: "steward_confirmed",
      classification_state: "confirmed",
      extraction_state: "reviewed",
      review_decision: "confirmed",
      reviewed_summary: reviewedSummary,
      reviewed_by: input.actor.id,
      reviewed_at: input.occurred_at,
      authorized: true,
      audit_provenance: [...asset.audit_provenance, {
        event: "steward_confirmed",
        actor_id: input.actor.id,
        occurred_at: input.occurred_at,
        details: { building_id: input.building_id, externally_shareable: input.externally_shareable },
      }],
    } : asset),
  };
}

function normalizeReviewedSummary(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("Document review requires a reviewed summary.");
  if (normalized.length > 2_000) throw new Error("Document reviewed summary exceeds 2000 characters.");
  return normalized;
}

function targetDocumentId(input: { asset_id?: string; document_id?: string }): string {
  const ids = [input.asset_id, input.document_id]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (ids.length !== 1) throw new Error("Document action requires exactly one document id.");
  return ids[0]!;
}

export function reviewDocumentAsset(
  registry: GovernedAssetRegistry,
  input: {
    asset_id?: string;
    document_id?: string;
    reviewed_summary: string;
    externally_shareable?: boolean;
    actor: { id: string; role: UserRole };
    occurred_at: string;
  },
): GovernedAssetRegistry {
  requireAction(input.actor.role, "candidate.confirm");
  const documentId = targetDocumentId(input);
  const target = registry.assets.find((asset) => asset.id === documentId);
  if (!target) throw new Error(`Unknown source asset: ${documentId}.`);
  if (target.status !== "registered") throw new Error("Only registered document candidates can be reviewed.");
  if (!target.building_id || !target.building_alias_candidate) {
    throw new Error("Unresolved building alias blocks document review.");
  }
  const externallyShareable = input.externally_shareable ?? target.review_policy === "publishable_reference";
  if (externallyShareable && target.review_policy !== "publishable_reference") {
    throw new Error("Review-only or manual-review documents cannot be externally shareable.");
  }
  const reviewedSummary = normalizeReviewedSummary(input.reviewed_summary);
  return {
    assets: registry.assets.map((asset) => asset.id === target.id ? {
      ...asset,
      externally_shareable: externallyShareable,
      status: "steward_confirmed",
      classification_state: "confirmed",
      extraction_state: "reviewed",
      review_decision: "confirmed",
      reviewed_summary: reviewedSummary,
      reviewed_by: input.actor.id,
      reviewed_at: input.occurred_at,
      authorized: true,
      audit_provenance: [...asset.audit_provenance, {
        event: "reviewed",
        actor_id: input.actor.id,
        occurred_at: input.occurred_at,
        details: { externally_shareable: externallyShareable },
      }],
    } : asset),
  };
}

export function publishSourceAsset(
  registry: GovernedAssetRegistry,
  input: {
    asset_id: string;
    actor: { id: string; role: UserRole };
    occurred_at: string;
    current_linked_file_versions?: ReadonlyMap<string, string>;
  },
): GovernedAssetRegistry {
  requireAction(input.actor.role, "record.publish");
  const target = registry.assets.find((asset) => asset.id === input.asset_id);
  if (!target) throw new Error(`Unknown source asset: ${input.asset_id}.`);
  if (target.status !== "steward_confirmed" || target.classification_state !== "confirmed" || !target.authorized) {
    throw new Error("Data Steward confirmation and authorization are required before publication.");
  }
  if (!target.building_id || !target.building_alias_candidate) throw new Error("Unresolved building alias blocks publication.");
  if (target.extraction_state === "unsupported") throw new Error("Unsupported CAD extraction blocks publication.");
  if (target.review_policy !== "publishable_reference") {
    throw new Error("Review-only or manual-review documents cannot be published externally.");
  }
  if (target.document_type !== "floor_plan" && !target.reviewed_summary) {
    throw new Error("Document publication requires a reviewed summary.");
  }
  if (target.document_category === "floor_plan"
    && (!target.linked_file_version_id
      || input.current_linked_file_versions?.get(target.linked_file_version_id) !== target.building_id)) {
    throw new Error("Floor-plan publication requires a matching current linked file version.");
  }
  if (restrictedAssetCategories.has(target.document_category) || target.confidentiality !== "public_candidate" || !target.externally_shareable) {
    throw new Error("Confidential or non-shareable sources cannot be published externally.");
  }

  const priors = registry.assets.filter((asset) => asset.id !== target.id
    && asset.status === "published"
    && asset.building_id === target.building_id
    && asset.version_family === target.version_family);
  const prior = priors.at(-1);
  return {
    assets: registry.assets.map((asset) => {
      if (asset.id === target.id) return {
        ...asset,
        status: "published" as const,
        active: true,
        supersedes: prior?.id ?? asset.supersedes,
        audit_provenance: [...asset.audit_provenance, {
          event: "published" as const,
          actor_id: input.actor.id,
          occurred_at: input.occurred_at,
          details: { supersedes: prior?.id ?? null },
        }],
      };
      if (priors.some((candidate) => candidate.id === asset.id)) return {
        ...asset,
        status: "superseded" as const,
        active: false,
        audit_provenance: [...asset.audit_provenance, {
          event: "superseded" as const,
          actor_id: input.actor.id,
          occurred_at: input.occurred_at,
          details: { successor_id: target.id },
        }],
      };
      return asset;
    }),
  };
}

export function publishDocumentAsset(
  registry: GovernedAssetRegistry,
  input: {
    asset_id?: string;
    document_id?: string;
    actor: { id: string; role: UserRole };
    occurred_at: string;
    current_linked_file_versions?: ReadonlyMap<string, string>;
  },
): GovernedAssetRegistry {
  return publishSourceAsset(registry, {
    asset_id: targetDocumentId(input),
    actor: input.actor,
    occurred_at: input.occurred_at,
    ...(input.current_linked_file_versions
      ? { current_linked_file_versions: input.current_linked_file_versions }
      : {}),
  });
}

export function isDerivedCurrentAsset(
  asset: GovernedSourceAsset,
  assets: readonly GovernedSourceAsset[],
): boolean {
  if (asset.status !== "published" || !asset.active) return false;
  return !assets.some((candidate) =>
    candidate.id !== asset.id
    && candidate.status === "published"
    && candidate.active
    && candidate.building_id === asset.building_id
    && candidate.version_family === asset.version_family
    && candidate.supersedes === asset.id,
  );
}

export function selectExternallyVisibleAssets(
  assets: readonly GovernedSourceAsset[],
  scope?: { building_id: string },
): GovernedSourceAsset[] {
  return assets.filter((asset) =>
    asset.status === "published"
    && asset.active
    && (!scope || asset.building_id === scope.building_id)
    && isDerivedCurrentAsset(asset, assets)
    && asset.authorized
    && asset.externally_shareable,
  );
}

export function selectPublishedDocumentReferences(
  assets: readonly GovernedSourceAsset[],
  authorizedBuildingIds: readonly string[],
): PublishedDocumentReference[] {
  const allowedBuildings = new Set(authorizedBuildingIds);
  const eligible = assets.filter((asset) =>
    asset.status === "published"
    && asset.active
    && asset.building_id !== null
    && allowedBuildings.has(asset.building_id)
    && isDerivedCurrentAsset(asset, assets)
    && asset.authorized
    && asset.externally_shareable
    && asset.review_policy === "publishable_reference"
    && !restrictedAssetCategories.has(asset.document_category)
    && typeof asset.reviewed_summary === "string"
    && asset.reviewed_summary.trim().length > 0,
  );
  const families = new Set<string>();
  return eligible.map((asset) => {
    const family = `${asset.building_id}:${asset.version_family}`;
    if (families.has(family)) throw new Error(`Multiple current published documents exist for ${family}.`);
    families.add(family);
    return {
      building_id: asset.building_id!,
      document_type: asset.document_type,
      reviewed_summary: asset.reviewed_summary!,
    };
  });
}

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
  if (action.startsWith("report.")) return false;
  const permissions: Record<UserRole, string[]> = {
    data_steward: ["source.upload", "candidate.confirm"],
    senior_reviewer: ["candidate.review", "record.publish"],
    lm_manager: [
      "package.prepare",
      "package.approve",
      "package.send",
    ],
    lm_member: ["package.prepare"],
    team_lead: ["package.prepare"],
    admin: ["*"],
  };
  return permissions[role].includes("*") || permissions[role].includes(action);
}

export type WeeklyReportAction = "report.prepare" | "report.approve" | "report.send";

export function canPerformWeeklyReportAction(role: UserRole, action: WeeklyReportAction): boolean {
  if (action === "report.prepare") {
    return role === "lm_manager" || role === "lm_member" || role === "team_lead" || role === "admin";
  }
  return role === "lm_manager";
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

export type WeeklyReportStatus = "draft" | "patch_pending" | "approved" | "sent" | "stale";

export const WEEKLY_REPORT_INVESTIGATION_COMMANDS = [
  "통화내용 확인해서 이번주 변동사항 업데이트 해",
  "이메일 확인해서 이번주 변동사항 업데이트 해",
  "협의 중인 면적 변동 있는지 확인해",
  "협의 중인 층 변동 있는지 확인해",
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐",
] as const;

export type WeeklyReportInvestigationCommand =
  (typeof WEEKLY_REPORT_INVESTIGATION_COMMANDS)[number];

export interface ReportSourceReference {
  id: string;
  source_type: string;
  building_id: string;
  occurred_at: string;
  share_scope: "external_reportable";
  summary: string;
}

export interface WeeklyReportPeriod {
  from: string;
  to: string;
}

export interface WeeklyReportNextAction {
  action: string;
  owner: string;
  due_date: string;
}

export interface WeeklyReportSections {
  key_issue: string;
  changes_since_last_report: string[];
  activity_summary: string[];
  negotiated_area_floor_changes: string[];
  competitor_buildings: string[];
  blocker_and_pending_approval: string[];
  next_actions: WeeklyReportNextAction[];
}

export interface WeeklyReportAttachment {
  id: string;
  building_id: string;
  version_id: string;
  filename: string;
}

export interface ConfiguredReportRecipients extends RecipientGroup {
  configuration_id: string;
}

export interface WeeklyReportCover {
  subject: string;
  body: string;
}

export type WeeklyReportPatchOperationKind = "replace" | "append" | "remove" | "reorder";

export interface WeeklyReportPatchOperation {
  section: keyof WeeklyReportSections;
  operation: WeeklyReportPatchOperationKind;
  before: unknown;
  after: unknown;
  source_reference_ids: string[];
}

export interface WeeklyReportPatchFinding {
  category: string;
  finding: string;
  source_reference_ids: string[];
  confidence: number;
}

export interface WeeklyReportPatchCandidate {
  id: string;
  command: WeeklyReportInvestigationCommand;
  target_building_ids: string[];
  findings: WeeklyReportPatchFinding[];
  operations: WeeklyReportPatchOperation[];
  unresolved: Array<{ field: string; question: string }>;
}

export interface AcceptedWeeklyReportPatch {
  candidate: WeeklyReportPatchCandidate;
  accepted_by: string;
  accepted_at: string;
}

export interface WeeklyReportApproval {
  approved_by: string | null;
  approved_at: string | null;
}

export interface WeeklyReportDelivery {
  sent_at: string | null;
  idempotency_key: string | null;
}

interface WeeklyReportProtectedSnapshot {
  building_id: string;
  reporting_period: WeeklyReportPeriod;
  recipients: ConfiguredReportRecipients;
  sources: ReportSourceReference[];
  attachments: WeeklyReportAttachment[];
  current_material_ids: string[];
  cover: WeeklyReportCover;
}

export interface WeeklyReport {
  id: string;
  building_id: string;
  reporting_period: WeeklyReportPeriod;
  status: WeeklyReportStatus;
  base_sections: WeeklyReportSections;
  current_sections: WeeklyReportSections;
  pending_candidate: WeeklyReportPatchCandidate | null;
  accepted_patch_history: AcceptedWeeklyReportPatch[];
  sources: ReportSourceReference[];
  attachments: WeeklyReportAttachment[];
  current_material_ids: string[];
  recipients: ConfiguredReportRecipients;
  cover: WeeklyReportCover;
  unresolved: string[];
  approval: WeeklyReportApproval;
  delivery: WeeklyReportDelivery;
  protected_snapshot: WeeklyReportProtectedSnapshot;
}

export interface WeeklyReportAuditEvent {
  id: string;
  event_type:
    | "report.drafted"
    | "report.patch_proposed"
    | "report.patch_accepted"
    | "report.patch_rejected"
    | "report.approved"
    | "report.sent.sandbox"
    | "report.marked_stale";
  actor_id: string;
  actor_role: UserRole;
  report_id: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface WeeklyReportActivity {
  id: string;
  event_type: "report.sent.sandbox";
  report_id: string;
  building_id: string;
  occurred_at: string;
  summary: string;
}

export interface WeeklyReportState {
  reports: WeeklyReport[];
  activities: WeeklyReportActivity[];
  audit: WeeklyReportAuditEvent[];
}

export interface CreateWeeklyReportDraftInput {
  id: string;
  building_id: string;
  reporting_period: WeeklyReportPeriod;
  sections: WeeklyReportSections;
  sources: ReportSourceReference[];
  attachments: WeeklyReportAttachment[];
  material_version_ids: string[];
  recipients: ConfiguredReportRecipients;
  cover: WeeklyReportCover;
  unresolved?: string[];
}

export interface WeeklyReportDriftEvidence {
  current_sources?: readonly ReportSourceReference[];
  current_recipients?: ConfiguredReportRecipients;
  source_content_drift?: boolean;
  recipient_content_drift?: boolean;
}

const WEEKLY_REPORT_SECTION_KEYS: ReadonlyArray<keyof WeeklyReportSections> = [
  "key_issue",
  "changes_since_last_report",
  "activity_summary",
  "negotiated_area_floor_changes",
  "competitor_buildings",
  "blocker_and_pending_approval",
  "next_actions",
];

function cloneWeeklyReportSections(sections: WeeklyReportSections): WeeklyReportSections {
  return {
    key_issue: sections.key_issue,
    changes_since_last_report: [...sections.changes_since_last_report],
    activity_summary: [...sections.activity_summary],
    negotiated_area_floor_changes: [...sections.negotiated_area_floor_changes],
    competitor_buildings: [...sections.competitor_buildings],
    blocker_and_pending_approval: [...sections.blocker_and_pending_approval],
    next_actions: sections.next_actions.map((item) => ({ ...item })),
  };
}

function cloneReportSource(source: ReportSourceReference): ReportSourceReference {
  return { ...source };
}

function cloneReportRecipients(recipients: ConfiguredReportRecipients): ConfiguredReportRecipients {
  return {
    configuration_id: recipients.configuration_id,
    to: recipients.to.map((recipient) => ({ ...recipient })),
    cc: recipients.cc.map((recipient) => ({ ...recipient })),
  };
}

function clonePatchCandidate(candidate: WeeklyReportPatchCandidate): WeeklyReportPatchCandidate {
  return {
    ...candidate,
    target_building_ids: [...candidate.target_building_ids],
    findings: candidate.findings.map((finding) => ({
      ...finding,
      source_reference_ids: [...finding.source_reference_ids],
    })),
    operations: candidate.operations.map((operation) => ({
      ...operation,
      before: structuredClone(operation.before),
      after: structuredClone(operation.after),
      source_reference_ids: [...operation.source_reference_ids],
    })),
    unresolved: candidate.unresolved.map((item) => ({ ...item })),
  };
}

function cloneProtectedSnapshot(report: WeeklyReportProtectedSnapshot): WeeklyReportProtectedSnapshot {
  return {
    building_id: report.building_id,
    reporting_period: { ...report.reporting_period },
    recipients: cloneReportRecipients(report.recipients),
    sources: report.sources.map(cloneReportSource),
    attachments: report.attachments.map((attachment) => ({ ...attachment })),
    current_material_ids: [...report.current_material_ids],
    cover: { ...report.cover },
  };
}

function reportAudit(
  state: WeeklyReportState,
  event: Omit<WeeklyReportAuditEvent, "id">,
): WeeklyReportAuditEvent {
  return { ...event, id: `report-audit-${state.audit.length + 1}` };
}

function requireWeeklyReportActor(actor: { id: string; role: UserRole }, action: WeeklyReportAction): void {
  if (!canPerformWeeklyReportAction(actor.role, action)) {
    throw new Error(`Role ${actor.role} is not allowed to perform ${action}.`);
  }
}

function requireLmManager(actor: { id: string; role: UserRole }, action: "report.approve" | "report.send"): void {
  if (!canPerformWeeklyReportAction(actor.role, action)) {
    throw new Error(`Role ${actor.role} is not allowed to perform ${action}; LM Manager approval is required.`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isExternalReportableSource(value: unknown): value is ReportSourceReference {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  return isNonEmptyString(source.id)
    && isNonEmptyString(source.source_type)
    && isNonEmptyString(source.building_id)
    && isNonEmptyString(source.occurred_at)
    && source.share_scope === "external_reportable"
    && isNonEmptyString(source.summary);
}

export function selectExternalReportableSources(
  sources: readonly unknown[],
  buildingId: string,
  currentSourceIds: ReadonlySet<string>,
): ReportSourceReference[] {
  return sources.filter((source): source is ReportSourceReference =>
    isExternalReportableSource(source)
      && source.building_id === buildingId
      && currentSourceIds.has(source.id));
}

function validateConfiguredReportRecipients(recipients: ConfiguredReportRecipients): void {
  if (!recipients.configuration_id) {
    throw new Error("A configured recipient group is required for a weekly report.");
  }
  validateLandlordRecipients({
    to: recipients.to.map((recipient) => ({ ...recipient })),
    cc: recipients.cc.map((recipient) => ({ ...recipient })),
  });
  const addresses = [...recipients.to, ...recipients.cc].map((recipient) => recipient.email);
  if (addresses.some((address) => !address) || new Set(addresses).size !== addresses.length) {
    throw new Error("Configured weekly-report recipients must have unique non-empty addresses.");
  }
}

function assertCurrentReportInputs(
  report: WeeklyReport,
  currentMaterialIds: ReadonlySet<string>,
  currentRecipientConfigurationId: string,
): void {
  if (report.recipients.configuration_id !== currentRecipientConfigurationId) {
    throw new Error("Weekly report is stale because its recipient configuration changed.");
  }
  if (report.current_material_ids.some((id) => !currentMaterialIds.has(id))) {
    throw new Error("Weekly report is stale because referenced material is no longer current.");
  }
}

function assertReportSourceReferences(
  report: Pick<WeeklyReport, "building_id" | "sources">,
  sourceReferenceIds: readonly string[],
): void {
  if (sourceReferenceIds.length === 0) {
    throw new Error("Every weekly-report finding and patch operation requires a source reference.");
  }
  const available = new Set(report.sources.map((source) => source.id));
  for (const id of sourceReferenceIds) {
    if (!available.has(id)) throw new Error(`Weekly-report patch references unavailable source ${id}.`);
  }
}

function isNextAction(value: unknown): value is WeeklyReportNextAction {
  if (typeof value !== "object" || value === null) return false;
  const action = value as Record<string, unknown>;
  return isNonEmptyString(action.action)
    && isNonEmptyString(action.owner)
    && isNonEmptyString(action.due_date);
}

function isValidSectionValue(section: keyof WeeklyReportSections, value: unknown): boolean {
  if (section === "key_issue") return typeof value === "string";
  if (!Array.isArray(value)) return false;
  if (section === "next_actions") return value.every(isNextAction);
  return value.every((item) => typeof item === "string");
}

function applyWeeklyReportOperations(
  sections: WeeklyReportSections,
  operations: readonly WeeklyReportPatchOperation[],
): WeeklyReportSections {
  const next = cloneWeeklyReportSections(sections);
  for (const operation of operations) {
    if (!WEEKLY_REPORT_SECTION_KEYS.includes(operation.section)) {
      throw new Error(`Weekly-report patch cannot alter protected field ${String(operation.section)}.`);
    }
    if (!valuesEqual(next[operation.section], operation.before)) {
      throw new Error(`Weekly-report patch before-value does not match section ${operation.section}.`);
    }
    if (!isValidSectionValue(operation.section, operation.after)) {
      throw new Error(`Weekly-report patch has an invalid value for section ${operation.section}.`);
    }
    if (operation.operation === "append"
      && (!Array.isArray(operation.before)
        || !Array.isArray(operation.after)
        || operation.after.length < operation.before.length)) {
      throw new Error(`Weekly-report append operation is invalid for section ${operation.section}.`);
    }
    if (operation.operation === "remove"
      && (!Array.isArray(operation.before)
        || !Array.isArray(operation.after)
        || operation.after.length > operation.before.length)) {
      throw new Error(`Weekly-report remove operation is invalid for section ${operation.section}.`);
    }
    if (operation.operation === "reorder"
      && (!Array.isArray(operation.before)
        || !Array.isArray(operation.after)
        || operation.after.length !== operation.before.length)) {
      throw new Error(`Weekly-report reorder operation is invalid for section ${operation.section}.`);
    }
    Object.assign(next, { [operation.section]: structuredClone(operation.after) });
  }
  return next;
}

function assertPatchCandidate(report: WeeklyReport, candidate: WeeklyReportPatchCandidate): void {
  if (!WEEKLY_REPORT_INVESTIGATION_COMMANDS.includes(candidate.command)) {
    throw new Error("Unknown weekly-report investigation command.");
  }
  if (candidate.target_building_ids.length !== 1
    || candidate.target_building_ids[0] !== report.building_id) {
    throw new Error("Weekly-report patches must be scoped to exactly one matching building.");
  }
  if (candidate.findings.length === 0 || candidate.operations.length === 0) {
    throw new Error("A weekly-report patch requires findings and scoped operations.");
  }
  for (const finding of candidate.findings) {
    if (!Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1) {
      throw new Error("Weekly-report finding confidence must be between 0 and 1.");
    }
    assertReportSourceReferences(report, finding.source_reference_ids);
  }
  for (const operation of candidate.operations) {
    assertReportSourceReferences(report, operation.source_reference_ids);
  }
  applyWeeklyReportOperations(report.current_sections, candidate.operations);
}

export function assertWeeklyReportIntegrity(report: WeeklyReport): void {
  const protectedCurrent: WeeklyReportProtectedSnapshot = {
    building_id: report.building_id,
    reporting_period: report.reporting_period,
    recipients: report.recipients,
    sources: report.sources,
    attachments: report.attachments,
    current_material_ids: report.current_material_ids,
    cover: report.cover,
  };
  if (!valuesEqual(protectedCurrent, report.protected_snapshot)) {
    throw new Error("Weekly-report protected building, period, recipients, sources, attachments, material IDs, or cover were altered.");
  }
  if (report.status === "patch_pending" && !report.pending_candidate) {
    throw new Error("Weekly-report patch-pending status requires a candidate.");
  }
  if (report.status !== "patch_pending" && report.pending_candidate) {
    throw new Error("Weekly-report pending candidate exists outside patch-pending status.");
  }
  if ((report.approval.approved_by === null) !== (report.approval.approved_at === null)) {
    throw new Error("Weekly-report approval metadata is incomplete.");
  }
  if ((report.delivery.sent_at === null) !== (report.delivery.idempotency_key === null)) {
    throw new Error("Weekly-report send metadata is incomplete.");
  }
  if (report.status === "approved" && !report.approval.approved_by) {
    throw new Error("Approved weekly report is missing approval metadata.");
  }
  if (report.status === "sent" && (!report.approval.approved_by || !report.delivery.sent_at)) {
    throw new Error("Sent weekly report is missing approval or send metadata.");
  }
  if ((report.status === "draft" || report.status === "patch_pending")
    && (report.approval.approved_by || report.delivery.sent_at)) {
    throw new Error("Draft weekly report contains protected approval or send metadata.");
  }

  let replayed = cloneWeeklyReportSections(report.base_sections);
  for (const accepted of report.accepted_patch_history) {
    assertPatchCandidate({ ...report, current_sections: replayed }, accepted.candidate);
    replayed = applyWeeklyReportOperations(replayed, accepted.candidate.operations);
  }
  if (!valuesEqual(replayed, report.current_sections)) {
    throw new Error("Weekly-report current sections do not match accepted patch replay.");
  }
}

export function createInitialWeeklyReportState(): WeeklyReportState {
  return { reports: [], activities: [], audit: [] };
}

export function createWeeklyReportDraft(
  state: WeeklyReportState,
  input: CreateWeeklyReportDraftInput,
  currentMaterialIds: ReadonlySet<string>,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): WeeklyReportState {
  requireWeeklyReportActor(actor, "report.prepare");
  if (state.reports.some((report) => report.id === input.id)) {
    throw new Error(`Weekly report ${input.id} already exists.`);
  }
  if (state.reports.some((report) =>
    report.building_id === input.building_id
      && valuesEqual(report.reporting_period, input.reporting_period))) {
    throw new Error("A weekly report already exists for this building and reporting period.");
  }
  if (!input.building_id || input.reporting_period.from > input.reporting_period.to) {
    throw new Error("Weekly report requires a valid building and reporting period.");
  }
  validateConfiguredReportRecipients(input.recipients);
  if (input.sources.length === 0) throw new Error("Weekly report requires external-reportable sources.");
  const normalizedSources = selectExternalReportableSources(
    input.sources,
    input.building_id,
    currentMaterialIds,
  );
  if (normalizedSources.length !== input.sources.length) {
    throw new Error("Weekly report sources must be current, building-scoped, and external_reportable.");
  }
  if (new Set(normalizedSources.map((source) => source.id)).size !== normalizedSources.length) {
    throw new Error("Weekly report source references must be unique.");
  }
  if (!WEEKLY_REPORT_SECTION_KEYS.every((section) => isValidSectionValue(section, input.sections[section]))) {
    throw new Error("Weekly report contains invalid section content.");
  }
  if (input.attachments.some((attachment) =>
    attachment.building_id !== input.building_id
      || !attachment.id
      || !attachment.version_id
      || !attachment.filename)) {
    throw new Error("Weekly report attachments must be building-scoped versioned material.");
  }
  if (new Set(input.attachments.map((attachment) => attachment.id)).size !== input.attachments.length) {
    throw new Error("Weekly report attachments must be unique.");
  }
  const referencedMaterialIds = [...new Set([
    ...input.material_version_ids,
    ...input.attachments.map((attachment) => attachment.version_id),
    ...normalizedSources.map((source) => source.id),
  ])];
  if (referencedMaterialIds.length === 0
    || referencedMaterialIds.some((id) => !currentMaterialIds.has(id))) {
    throw new Error("Weekly report may reference only current material IDs.");
  }
  const recipients = cloneReportRecipients(input.recipients);
  const sources = normalizedSources.map(cloneReportSource);
  const attachments = input.attachments.map((attachment) => ({ ...attachment }));
  const protectedValues: WeeklyReportProtectedSnapshot = {
    building_id: input.building_id,
    reporting_period: { ...input.reporting_period },
    recipients,
    sources,
    attachments,
    current_material_ids: referencedMaterialIds,
    cover: { ...input.cover },
  };
  const report: WeeklyReport = {
    id: input.id,
    ...cloneProtectedSnapshot(protectedValues),
    status: "draft",
    base_sections: cloneWeeklyReportSections(input.sections),
    current_sections: cloneWeeklyReportSections(input.sections),
    pending_candidate: null,
    accepted_patch_history: [],
    unresolved: [...(input.unresolved ?? [])],
    approval: { approved_by: null, approved_at: null },
    delivery: { sent_at: null, idempotency_key: null },
    protected_snapshot: cloneProtectedSnapshot(protectedValues),
  };
  assertWeeklyReportIntegrity(report);
  return {
    ...state,
    reports: [...state.reports, report],
    audit: [...state.audit, reportAudit(state, {
      event_type: "report.drafted",
      actor_id: actor.id,
      actor_role: actor.role,
      report_id: report.id,
      occurred_at: occurredAt,
      metadata: { source_count: sources.length, material_count: referencedMaterialIds.length },
    })],
  };
}

export function proposeWeeklyReportPatch(
  state: WeeklyReportState,
  reportId: string,
  candidate: WeeklyReportPatchCandidate,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): WeeklyReportState {
  requireWeeklyReportActor(actor, "report.prepare");
  const target = state.reports.find((report) => report.id === reportId);
  if (!target || target.status !== "draft") {
    throw new Error("Only a draft weekly report can receive a patch candidate.");
  }
  assertWeeklyReportIntegrity(target);
  assertPatchCandidate(target, candidate);
  const pendingCandidate = clonePatchCandidate(candidate);
  return {
    ...state,
    reports: state.reports.map((report) => report.id === reportId
      ? { ...report, status: "patch_pending" as const, pending_candidate: pendingCandidate }
      : report),
    audit: [...state.audit, reportAudit(state, {
      event_type: "report.patch_proposed",
      actor_id: actor.id,
      actor_role: actor.role,
      report_id: reportId,
      occurred_at: occurredAt,
      metadata: { candidate_id: candidate.id, command: candidate.command },
    })],
  };
}

export function decideWeeklyReportPatch(
  state: WeeklyReportState,
  reportId: string,
  decision: "accept" | "reject",
  actor: { id: string; role: UserRole },
  occurredAt: string,
): WeeklyReportState {
  requireWeeklyReportActor(actor, "report.prepare");
  const target = state.reports.find((report) => report.id === reportId);
  if (!target || target.status !== "patch_pending" || !target.pending_candidate) {
    throw new Error("No weekly-report patch candidate is pending.");
  }
  assertWeeklyReportIntegrity(target);
  if (decision === "accept" && target.pending_candidate.unresolved.length > 0) {
    throw new Error("A weekly-report patch with unresolved findings cannot be accepted.");
  }
  const nextSections = decision === "accept"
    ? applyWeeklyReportOperations(target.current_sections, target.pending_candidate.operations)
    : cloneWeeklyReportSections(target.current_sections);
  const acceptedPatch = decision === "accept" ? {
    candidate: clonePatchCandidate(target.pending_candidate),
    accepted_by: actor.id,
    accepted_at: occurredAt,
  } : null;
  const nextReport: WeeklyReport = {
    ...target,
    status: "draft",
    current_sections: nextSections,
    pending_candidate: null,
    accepted_patch_history: acceptedPatch
      ? [...target.accepted_patch_history, acceptedPatch]
      : [...target.accepted_patch_history],
  };
  assertWeeklyReportIntegrity(nextReport);
  return {
    ...state,
    reports: state.reports.map((report) => report.id === reportId ? nextReport : report),
    audit: [...state.audit, reportAudit(state, {
      event_type: decision === "accept" ? "report.patch_accepted" : "report.patch_rejected",
      actor_id: actor.id,
      actor_role: actor.role,
      report_id: reportId,
      occurred_at: occurredAt,
      metadata: { candidate_id: target.pending_candidate.id },
    })],
  };
}

export function approveWeeklyReport(
  state: WeeklyReportState,
  reportId: string,
  currentMaterialIds: ReadonlySet<string>,
  currentRecipientConfigurationId: string,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): WeeklyReportState {
  requireLmManager(actor, "report.approve");
  const target = state.reports.find((report) => report.id === reportId);
  if (!target || target.status !== "draft" || target.pending_candidate || target.unresolved.length > 0) {
    throw new Error("Only a complete draft without pending or unresolved patches can be approved.");
  }
  validateConfiguredReportRecipients(target.recipients);
  assertWeeklyReportIntegrity(target);
  assertCurrentReportInputs(target, currentMaterialIds, currentRecipientConfigurationId);
  const nextReport: WeeklyReport = {
    ...target,
    status: "approved",
    approval: { approved_by: actor.id, approved_at: occurredAt },
  };
  assertWeeklyReportIntegrity(nextReport);
  return {
    ...state,
    reports: state.reports.map((report) => report.id === reportId ? nextReport : report),
    audit: [...state.audit, reportAudit(state, {
      event_type: "report.approved",
      actor_id: actor.id,
      actor_role: actor.role,
      report_id: reportId,
      occurred_at: occurredAt,
      metadata: { recipient_configuration_id: currentRecipientConfigurationId },
    })],
  };
}

export function sendWeeklyReport(
  state: WeeklyReportState,
  reportId: string,
  idempotencyKey: string,
  currentMaterialIds: ReadonlySet<string>,
  currentRecipientConfigurationId: string,
  actor: { id: string; role: UserRole },
  occurredAt: string,
): WeeklyReportState {
  requireLmManager(actor, "report.send");
  if (!idempotencyKey) throw new Error("A weekly-report send requires an idempotency key.");
  const reusedKey = state.reports.find((report) =>
    report.delivery.idempotency_key === idempotencyKey && report.id !== reportId);
  if (reusedKey) throw new Error("Idempotency key is already assigned to another weekly report.");
  const target = state.reports.find((report) => report.id === reportId);
  if (!target) throw new Error(`Unknown weekly report: ${reportId}.`);
  assertWeeklyReportIntegrity(target);
  if (target.status === "sent" && target.delivery.idempotency_key === idempotencyKey) return state;
  if (target.status !== "approved" || target.pending_candidate || target.unresolved.length > 0) {
    throw new Error("Weekly-report send is blocked until clean LM Manager approval.");
  }
  validateConfiguredReportRecipients(target.recipients);
  assertCurrentReportInputs(target, currentMaterialIds, currentRecipientConfigurationId);
  const nextReport: WeeklyReport = {
    ...target,
    status: "sent",
    delivery: { sent_at: occurredAt, idempotency_key: idempotencyKey },
  };
  assertWeeklyReportIntegrity(nextReport);
  const activity: WeeklyReportActivity = {
    id: `report-activity-${state.activities.length + 1}`,
    event_type: "report.sent.sandbox",
    report_id: reportId,
    building_id: target.building_id,
    occurred_at: occurredAt,
    summary: `Sandbox weekly report sent to ${target.recipients.to.map((item) => item.email).join(", ")}.`,
  };
  return {
    ...state,
    reports: state.reports.map((report) => report.id === reportId ? nextReport : report),
    activities: [...state.activities, activity],
    audit: [...state.audit, reportAudit(state, {
      event_type: "report.sent.sandbox",
      actor_id: actor.id,
      actor_role: actor.role,
      report_id: reportId,
      occurred_at: occurredAt,
      metadata: { idempotency_key: idempotencyKey },
    })],
  };
}

export function markWeeklyReportStale(
  state: WeeklyReportState,
  reportId: string,
  currentMaterialIds: ReadonlySet<string>,
  currentRecipientConfigurationId: string,
  actor: { id: string; role: UserRole },
  occurredAt: string,
  driftEvidence?: WeeklyReportDriftEvidence,
): WeeklyReportState {
  const target = state.reports.find((report) => report.id === reportId);
  if (!target) throw new Error(`Unknown weekly report: ${reportId}.`);
  assertWeeklyReportIntegrity(target);
  if (target.status === "sent" || target.status === "stale") return state;
  const materialDrift = target.current_material_ids.some((id) => !currentMaterialIds.has(id));
  const recipientConfigurationDrift =
    target.recipients.configuration_id !== currentRecipientConfigurationId;
  const canonicalSources = (sources: readonly ReportSourceReference[]) =>
    sources.map((source) => ({ ...source })).sort((left, right) =>
      left.id.localeCompare(right.id) || JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const canonicalRecipientContent = (recipients: ConfiguredReportRecipients) => {
    const sortRecipients = (items: ConfiguredReportRecipients["to"]) =>
      items.map((recipient) => structuredClone(recipient)).sort((left, right) =>
        left.email.localeCompare(right.email)
          || left.role.localeCompare(right.role)
          || JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return { to: sortRecipients(recipients.to), cc: sortRecipients(recipients.cc) };
  };
  const sourceContentDrift = Boolean(driftEvidence?.source_content_drift)
    || (driftEvidence?.current_sources !== undefined
      && !valuesEqual(canonicalSources(target.sources), canonicalSources(driftEvidence.current_sources)));
  const recipientContentDrift = Boolean(driftEvidence?.recipient_content_drift)
    || (driftEvidence?.current_recipients !== undefined
      && !valuesEqual(
        canonicalRecipientContent(target.recipients),
        canonicalRecipientContent(driftEvidence.current_recipients),
      ));
  const recipientDrift = recipientConfigurationDrift || recipientContentDrift;
  if (!materialDrift && !recipientDrift && !sourceContentDrift) return state;
  const nextReport: WeeklyReport = {
    ...target,
    status: "stale",
    pending_candidate: null,
  };
  assertWeeklyReportIntegrity(nextReport);
  return {
    ...state,
    reports: state.reports.map((report) => report.id === reportId ? nextReport : report),
    audit: [...state.audit, reportAudit(state, {
      event_type: "report.marked_stale",
      actor_id: actor.id,
      actor_role: actor.role,
      report_id: reportId,
      occurred_at: occurredAt,
      metadata: {
        material_drift: materialDrift,
        recipient_drift: recipientDrift,
        recipient_configuration_drift: recipientConfigurationDrift,
        recipient_content_drift: recipientContentDrift,
        source_content_drift: sourceContentDrift,
      },
    })],
  };
}
