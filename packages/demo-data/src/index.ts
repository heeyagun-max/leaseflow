import {
  createInitialOperationalState,
  createInitialWeeklyReportState,
  confirmSourceAsset,
  EXPECTED_PUBLICATION_FIELDS,
  publishSourceAsset,
  registerSourceAsset,
  requireExternalRecord,
  selectCurrentFloorPlan,
  selectCurrentPublished,
  selectExternallyVisibleAssets,
  type CandidateChange,
  type AssetDocumentCategory,
  type ConfiguredReportRecipients,
  type CreateWeeklyReportDraftInput,
  type ExpectedPublicationField,
  type FileVersion,
  type GovernedPublicationState,
  type GovernedAssetRegistry,
  type DraftMaterial,
  type OperationalState,
  type ReportSourceReference,
  type UserRole,
  type VersionedRecord,
  type WeeklyReportSections,
  type WeeklyReportState,
} from "@leaseflow/domain";

export const DEMO_AS_OF = new Date("2026-07-18T12:00:00.000Z");

export const demoSourceUpdate = {
  id: "src-cobalt-jul",
  buildingId: "bld-cobalt",
  buildingName: "Cobalt Finance Center",
  effectiveDate: "2026-07-18",
  content: {
    floor: "5F",
    previous_marketed_area_py: 300,
    current_marketed_area_py: 200,
    previous_rent_free_months: 3,
    current_rent_free_months: 2,
    previous_supported_parking_spaces: 3,
    current_supported_parking_spaces: 2,
    previous_plan: "CFC_5F_plan_v1.svg",
    current_plan: "CFC_5F_plan_v2.svg",
  },
  changes: [
    {field:"marketed_area_py", previous:300, proposed:200, source:"July update / 5F"},
    {field:"floor_plan", previous:"CFC_5F_plan_v1.svg", proposed:"CFC_5F_plan_v2.svg", source:"July update / 5F plan"},
    {field:"rent_free_months", previous:3, proposed:2, source:"July update / incentives"},
    {field:"supported_parking_spaces", previous:3, proposed:2, source:"July update / parking"},
  ],
} as const;

export const demoUsers = [
  { id: "usr-junior", email: "junior@demo.leaseflow.local", display_name: "Mina Lee", role: "data_steward" },
  { id: "usr-senior", email: "senior@demo.leaseflow.local", display_name: "Daniel Park", role: "senior_reviewer" },
  { id: "usr-manager", email: "manager@demo.leaseflow.local", display_name: "James Kim", role: "lm_manager" },
] as const satisfies readonly { id: string; email: string; display_name: string; role: UserRole }[];

export type DemoUser = (typeof demoUsers)[number];

export interface DemoRecord extends VersionedRecord {
  kind: "availability" | "term";
  floor: string;
  field: "marketed_area_py" | "rent_free_months" | "supported_parking_spaces";
  value: number;
}

export interface DemoFileVersion extends FileVersion {
  file_type: "floor_plan";
}

export interface DemoOperationalState extends OperationalState {
  reports: WeeklyReportState;
}

export interface DemoState extends GovernedPublicationState<DemoRecord, DemoFileVersion> {
  schema_version: 3;
  source_id: "src-cobalt-jul";
  asset_registry: GovernedAssetRegistry;
  operations: DemoOperationalState;
}

export type LegacyDemoStateV2 = Omit<DemoState, "schema_version" | "operations" | "asset_registry"> & {
  schema_version: 2;
  operations: OperationalState;
  asset_registry?: GovernedAssetRegistry;
};

export function migrateDemoStateToV3(state: DemoState | LegacyDemoStateV2): DemoState {
  const cloned = structuredClone(state);
  return {
    ...cloned,
    schema_version: 3,
    asset_registry: cloned.asset_registry ?? createInitialAssetRegistry(),
    operations: {
      ...cloned.operations,
      reports: "reports" in cloned.operations ? cloned.operations.reports : createInitialWeeklyReportState(),
    },
  };
}

export const demoAssetRegistrationInputs = [
  {
    id: "asset-cobalt-render",
    observed_filename: "Synthetic_Cobalt_perspective_render_20260701.svg",
    synthetic_fingerprint: "synthetic:render-cobalt-20260701",
    mime_type: "image/svg+xml",
    byte_size: 2300,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Asset Studio",
    occurred_at: "2026-07-18T00:00:00.000Z",
  },
  {
    id: "asset-cobalt-flyer",
    observed_filename: "Synthetic_Cobalt_building_flyer_20260701.pdf",
    synthetic_fingerprint: "synthetic:flyer-cobalt-20260701",
    mime_type: "application/pdf",
    byte_size: 8400,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Leasing Lab",
    occurred_at: "2026-07-18T00:01:00.000Z",
  },
  {
    id: "asset-portfolio-july",
    observed_filename: "Synthetic_Portfolio_flyer_20260718.pdf",
    synthetic_fingerprint: "synthetic:portfolio-20260718",
    mime_type: "application/pdf",
    byte_size: 9200,
    building_alias_candidate: "Portfolio",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Leasing Lab",
    occurred_at: "2026-07-18T00:02:00.000Z",
  },
  {
    id: "asset-cobalt-plan-v1",
    observed_filename: "CFC_5F_plan_v1.svg",
    synthetic_fingerprint: "synthetic:cobalt-plan-v1",
    mime_type: "image/svg+xml",
    byte_size: 3100,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Design Office",
    linked_file_version_id: "file-cobalt-plan-v1",
    occurred_at: "2026-07-18T00:03:00.000Z",
  },
  {
    id: "asset-cobalt-plan-v2",
    observed_filename: "CFC_5F_plan_v2.svg",
    synthetic_fingerprint: "synthetic:cobalt-plan-v2",
    mime_type: "image/svg+xml",
    byte_size: 3300,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Design Office",
    linked_file_version_id: "file-cobalt-plan-v2",
    occurred_at: "2026-07-18T00:04:00.000Z",
  },
  {
    id: "asset-cobalt-area",
    observed_filename: "Synthetic_Cobalt_area_workbook_20260718.xlsx",
    synthetic_fingerprint: "synthetic:cobalt-area-20260718",
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    byte_size: 6100,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Asset Management",
    occurred_at: "2026-07-18T00:05:00.000Z",
  },
  {
    id: "asset-cobalt-legal",
    observed_filename: "Synthetic_Cobalt_legal_agreement_20260718.pdf",
    synthetic_fingerprint: "synthetic:cobalt-legal-20260718",
    mime_type: "application/pdf",
    byte_size: 7200,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Legal Office",
    occurred_at: "2026-07-18T00:06:00.000Z",
  },
  {
    id: "asset-cobalt-cad",
    observed_filename: "Synthetic_Cobalt_5F_plan_working.dwg",
    synthetic_fingerprint: "synthetic:cobalt-cad-working",
    mime_type: "application/acad",
    byte_size: 12500,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Design Office",
    occurred_at: "2026-07-18T00:07:00.000Z",
  },
] as const;

export function createInitialAssetRegistry(): GovernedAssetRegistry {
  let registry: GovernedAssetRegistry = { assets: [] };
  for (const input of demoAssetRegistrationInputs) registry = registerSourceAsset(registry, input);
  registry = confirmSourceAsset(registry, {
    asset_id: "asset-cobalt-plan-v1",
    building_id: "bld-cobalt",
    externally_shareable: true,
    actor: { id: "usr-junior", role: "data_steward" },
    occurred_at: "2026-07-18T00:08:00.000Z",
  });
  return publishSourceAsset(registry, {
    asset_id: "asset-cobalt-plan-v1",
    actor: { id: "usr-senior", role: "senior_reviewer" },
    occurred_at: "2026-07-18T00:09:00.000Z",
    current_linked_file_versions: new Map([["file-cobalt-plan-v1", "bld-cobalt"]]),
  });
}

const initialRecords: DemoRecord[] = [
  {id:"av-cobalt-5f-v1",building_id:"bld-cobalt",kind:"availability",floor:"5F",field:"marketed_area_py",value:300,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
  {id:"av-cobalt-5f-v2",building_id:"bld-cobalt",kind:"availability",floor:"5F",field:"marketed_area_py",value:200,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
  {id:"term-cobalt-rf-v1",building_id:"bld-cobalt",kind:"term",floor:"5F",field:"rent_free_months",value:3,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
  {id:"term-cobalt-rf-v2",building_id:"bld-cobalt",kind:"term",floor:"5F",field:"rent_free_months",value:2,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
  {id:"term-cobalt-park-v1",building_id:"bld-cobalt",kind:"term",floor:"5F",field:"supported_parking_spaces",value:3,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
  {id:"term-cobalt-park-v2",building_id:"bld-cobalt",kind:"term",floor:"5F",field:"supported_parking_spaces",value:2,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
];

const initialFiles: DemoFileVersion[] = [
  {id:"file-cobalt-plan-v1",building_id:"bld-cobalt",floor:"5F",filename:"CFC_5F_plan_v1.svg",file_type:"floor_plan",version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
  {id:"file-cobalt-plan-v2",building_id:"bld-cobalt",floor:"5F",filename:"CFC_5F_plan_v2.svg",file_type:"floor_plan",version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
];

export function createInitialDemoState(): DemoState {
  return structuredClone({
    schema_version: 3,
    source_id: "src-cobalt-jul",
    revision: 0,
    effective_date: demoSourceUpdate.effectiveDate,
    publication_scope: { building_id: "bld-cobalt", floor: "5F" },
    stage: "source_uploaded",
    candidates: [],
    records: initialRecords,
    files: initialFiles,
    asset_registry: createInitialAssetRegistry(),
    audit: [],
    operations: {
      ...createInitialOperationalState(),
      reports: createInitialWeeklyReportState(),
    },
  } satisfies DemoState);
}

export const demoExtractionResult = {
  building_id: "bld-cobalt",
  effective_date: "2026-07-18",
  changes: [
    {field:"marketed_area_py",floor:"5F",previous_value:300,proposed_value:200,state:"confirmed",external_shareable_candidate:true,source_pointer:"July update / 5F",confidence:0.99},
    {field:"floor_plan",floor:"5F",previous_value:"CFC_5F_plan_v1.svg",proposed_value:"CFC_5F_plan_v2.svg",state:"confirmed",external_shareable_candidate:true,source_pointer:"July update / 5F plan",confidence:0.99},
    {field:"rent_free_months",floor:"5F",previous_value:3,proposed_value:2,state:"confirmed",external_shareable_candidate:true,source_pointer:"July update / incentives",confidence:0.98},
    {field:"supported_parking_spaces",floor:"5F",previous_value:3,proposed_value:2,state:"confirmed",external_shareable_candidate:true,source_pointer:"July update / parking",confidence:0.98},
  ],
  unresolved: [],
} as const;

export function extractDemoSourceCandidates(_source: unknown = demoSourceUpdate): typeof demoExtractionResult {
  return structuredClone(demoExtractionResult);
}

export interface ExtractedSourceResult {
  building_id: string;
  effective_date: string;
  changes: readonly {
    field: string;
    floor: string | null;
    previous_value: unknown;
    proposed_value: unknown;
    state: "confirmed" | "under_discussion" | "unverified";
    external_shareable_candidate: boolean;
    source_pointer: string;
    confidence: number;
  }[];
  unresolved: readonly { field: string; question: string }[];
}

function isExpectedField(field: string): field is ExpectedPublicationField {
  return (EXPECTED_PUBLICATION_FIELDS as readonly string[]).includes(field);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);
}

function exactlyOne<T>(items: readonly T[], label: string): T {
  if (items.length !== 1) throw new Error(`Extraction mapping requires exactly one ${label}; found ${items.length}.`);
  return items[0]!;
}

export function mapSourceCandidatesToDomain(
  state: DemoState,
  extraction: ExtractedSourceResult,
): CandidateChange[] {
  if (extraction.building_id !== state.publication_scope.building_id
    || extraction.effective_date !== state.effective_date) {
    throw new Error("Extraction output is outside the selected source scope.");
  }
  if (extraction.unresolved.length > 0) {
    throw new Error("Extraction output contains unresolved source questions.");
  }
  if (extraction.changes.length !== EXPECTED_PUBLICATION_FIELDS.length) {
    throw new Error(`Extraction must map exactly ${EXPECTED_PUBLICATION_FIELDS.length} source changes.`);
  }

  const seen = new Set<ExpectedPublicationField>();
  return extraction.changes.map((change) => {
    if (!isExpectedField(change.field) || seen.has(change.field)) {
      throw new Error(`Extraction contains an unexpected or duplicate field: ${change.field}.`);
    }
    seen.add(change.field);
    if (change.floor !== state.publication_scope.floor) {
      throw new Error(`Extraction field ${change.field} is outside the selected floor.`);
    }

    if (change.field === "floor_plan") {
      const scoped = state.files.filter((file) =>
        file.building_id === extraction.building_id
        && file.floor === change.floor
        && file.file_type === "floor_plan");
      const predecessor = exactlyOne(scoped.filter((file) =>
        file.status === "published" && !file.superseded && valuesEqual(file.filename, change.previous_value)), "published predecessor file");
      const target = exactlyOne(scoped.filter((file) =>
        file.status === "candidate" && !file.superseded && valuesEqual(file.filename, change.proposed_value)), "candidate file version");
      return {
        id: `candidate-${target.id}`,
        building_id: extraction.building_id,
        field: change.field,
        floor: change.floor,
        target_type: "file",
        predecessor_version_id: predecessor.id,
        candidate_version_id: target.id,
        previous_value: change.previous_value,
        proposed_value: change.proposed_value,
        source_state: change.state,
        source_pointer: change.source_pointer,
        confidence: change.confidence,
        external_shareable_candidate: change.external_shareable_candidate,
        status: "candidate",
      };
    }

    const kind = change.field === "marketed_area_py" ? "availability" : "term";
    const scoped = state.records.filter((record) =>
      record.building_id === extraction.building_id
      && record.floor === change.floor
      && record.kind === kind
      && record.field === change.field);
    const predecessor = exactlyOne(scoped.filter((record) =>
      record.status === "published" && !record.superseded && valuesEqual(record.value, change.previous_value)), "published predecessor record");
    const target = exactlyOne(scoped.filter((record) =>
      record.status === "candidate" && !record.superseded && valuesEqual(record.value, change.proposed_value)), "candidate record version");
    return {
      id: `candidate-${target.id}`,
      building_id: extraction.building_id,
      field: change.field,
      floor: change.floor,
      target_type: "record",
      predecessor_version_id: predecessor.id,
      candidate_version_id: target.id,
      previous_value: change.previous_value,
      proposed_value: change.proposed_value,
      source_state: change.state,
      source_pointer: change.source_pointer,
      confidence: change.confidence,
      external_shareable_candidate: change.external_shareable_candidate,
      status: "candidate",
    };
  });
}

export interface MobilePublishedSnapshot {
  building_id: "bld-cobalt";
  building_name: "Cobalt Finance Center";
  floor: "5F";
  revision: number;
  publication_stage: DemoState["stage"];
  marketed_area_py: number;
  rent_free_months: number;
  supported_parking_spaces: number;
  floor_plan: {
    filename: string;
    download_url: string;
    version_id: string;
    source_pointer: string;
  };
  fact_sources: Record<"marketed_area" | "rent_free" | "supported_parking", { version_id: string; source_pointer: string }>;
  blocked_floor_plans: string[];
  source_assets: Array<{
    filename: string;
    category: AssetDocumentCategory;
    artifact_date: string | null;
    version_family: string;
    download_url: string | null;
  }>;
}

const mobileScope = { building_id: "bld-cobalt", floor: "5F" } as const;

function currentRecord(state: DemoState, field: DemoRecord["field"]): DemoRecord {
  const kind: DemoRecord["kind"] = field === "marketed_area_py" ? "availability" : "term";
  return requireExternalRecord(selectCurrentPublished(
    state.records.filter((record) =>
      record.building_id === mobileScope.building_id
      && record.floor === mobileScope.floor
      && record.kind === kind
      && record.field === field),
    DEMO_AS_OF,
  ));
}

export function createMobilePublishedSnapshot(state: DemoState): MobilePublishedSnapshot {
  const scopedPlans = state.files.filter((file) => file.file_type === "floor_plan");
  const plan = selectCurrentFloorPlan(scopedPlans, mobileScope.building_id, mobileScope.floor, DEMO_AS_OF);
  return {
    building_id: "bld-cobalt",
    building_name: "Cobalt Finance Center",
    floor: "5F",
    revision: state.revision,
    publication_stage: state.stage,
    marketed_area_py: currentRecord(state, "marketed_area_py").value,
    rent_free_months: currentRecord(state, "rent_free_months").value,
    supported_parking_spaces: currentRecord(state, "supported_parking_spaces").value,
    floor_plan: {
      filename: plan.filename,
      download_url: `/api/mobile/files/${encodeURIComponent(plan.filename)}`,
      version_id: plan.id,
      source_pointer: "Published floor-plan registry",
    },
    fact_sources: {
      marketed_area: { version_id: currentRecord(state, "marketed_area_py").id, source_pointer: "Published availability registry" },
      rent_free: { version_id: currentRecord(state, "rent_free_months").id, source_pointer: "Published commercial-terms registry" },
      supported_parking: { version_id: currentRecord(state, "supported_parking_spaces").id, source_pointer: "Published commercial-terms registry" },
    },
    blocked_floor_plans: state.files
      .filter((file) =>
        file.building_id === mobileScope.building_id
        && file.floor === mobileScope.floor
        && file.file_type === "floor_plan"
        && (file.superseded || file.status === "superseded"))
      .map((file) => file.filename),
    source_assets: selectExternallyVisibleAssets(state.asset_registry.assets, mobileScope)
      .filter((asset) => asset.document_category !== "floor_plan" || asset.linked_file_version_id === plan.id)
      .map((asset) => ({
        filename: asset.observed_filenames[0]!,
        category: asset.document_category,
        artifact_date: asset.artifact_date,
        version_family: asset.version_family,
        download_url: asset.document_category === "floor_plan"
          ? `/api/mobile/files/${encodeURIComponent(asset.observed_filenames[0]!)}`
          : null,
      })),
  };
}

export function createDemoDraftMaterial(state: DemoState): DraftMaterial {
  const snapshot = createMobilePublishedSnapshot(state);
  return {
    building_id: snapshot.building_id,
    building_name: snapshot.building_name,
    floor: snapshot.floor,
    facts: [
      { field: "marketed_area", label: "Marketed area", value: snapshot.marketed_area_py, unit: "py", ...snapshot.fact_sources.marketed_area },
      { field: "rent_free", label: "Rent-free", value: snapshot.rent_free_months, unit: "months", ...snapshot.fact_sources.rent_free },
      { field: "supported_parking", label: "Supported parking", value: snapshot.supported_parking_spaces, unit: "spaces", ...snapshot.fact_sources.supported_parking },
    ],
    files: [{ requested_file: "current_floor_plan", filename: snapshot.floor_plan.filename, version_id: snapshot.floor_plan.version_id, source_pointer: snapshot.floor_plan.source_pointer }],
  };
}

export function currentDemoMaterialVersionIds(state: DemoState): Set<string> {
  const material = createDemoDraftMaterial(state);
  return new Set([...material.facts.map((fact) => fact.version_id), ...material.files.map((file) => file.version_id)]);
}

export function requireCurrentPublishedDemoFile(state: DemoState, filename: string): DemoFileVersion {
  const current = selectCurrentFloorPlan(
    state.files.filter((file) => file.file_type === "floor_plan"),
    mobileScope.building_id,
    mobileScope.floor,
    DEMO_AS_OF,
  );
  if (filename !== current.filename) {
    throw new Error(`Stale floor plan blocked: ${filename}. Current plan is ${current.filename}.`);
  }
  return current;
}

export const demoRequest = {
  source: "call_transcript",
  text: "코발트 파이낸스센터 5층 최신 임대 가능 면적하고 렌트프리, 지원 주차 대수, 최신 평면도 정리해서 오늘 오후에 보내주세요.",
} as const;

export const assistantHome = {
  pendingSourceReviews: 1,
  pendingPackages: 1,
  weeklyReportsDue: 1,
  heroBuilding: "Cobalt Finance Center",
} as const;

export type DemoOutlookShareScope = "external_reportable" | "client_confidential";

export interface DemoMockOutlookMessage {
  id: string;
  building_id: string;
  thread_id: string;
  occurred_at: string;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  share_scope: DemoOutlookShareScope;
}

export const demoMockOutlookMessages = [
  {
    id: "mail-001",
    building_id: "bld-cobalt",
    thread_id: "thread-cobalt",
    occurred_at: "2026-07-16T09:30:00+09:00",
    direction: "inbound",
    subject: "Cobalt Finance Center 5F area update",
    body: "100 py has been occupied. Please use the revised 200 py marketing plan after approval.",
    share_scope: "external_reportable",
  },
  {
    id: "mail-002",
    building_id: "bld-cobalt",
    thread_id: "thread-cobalt",
    occurred_at: "2026-07-17T13:15:00+09:00",
    direction: "inbound",
    subject: "Revised incentives and parking support",
    body: "Rent-free is revised to two months and supported parking is two spaces. Senior approval is pending.",
    share_scope: "client_confidential",
  },
  {
    id: "mail-003",
    building_id: "bld-cobalt",
    thread_id: "thread-cobalt",
    occurred_at: "2026-07-18T11:05:00+09:00",
    direction: "outbound",
    subject: "Cobalt Finance Center 5F materials",
    body: "Approved package prepared and sent through LeaseFlow sandbox.",
    share_scope: "external_reportable",
  },
] as const satisfies readonly DemoMockOutlookMessage[];

function isExternalReportableDemoOutlookMessage(
  value: unknown,
  buildingId: string,
): value is DemoMockOutlookMessage & { share_scope: "external_reportable" } {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return message.building_id === buildingId
    && message.share_scope === "external_reportable"
    && typeof message.id === "string"
    && message.id.length > 0
    && typeof message.occurred_at === "string"
    && message.occurred_at.length > 0
    && typeof message.body === "string"
    && message.body.length > 0;
}

export function selectExternalReportableMockOutlook(
  messages: readonly unknown[],
  buildingId: string,
): ReportSourceReference[] {
  return messages
    .filter((message): message is DemoMockOutlookMessage & { share_scope: "external_reportable" } =>
      isExternalReportableDemoOutlookMessage(message, buildingId))
    .map((message) => ({
      id: message.id,
      source_type: "mock_outlook",
      building_id: message.building_id,
      occurred_at: message.occurred_at,
      share_scope: "external_reportable",
      summary: message.body,
    }));
}

export const demoWeeklyReportRecipientGroup = {
  configuration_id: "recipient-group-cobalt-weekly-v1",
  building_id: "bld-cobalt",
  to: [{ email: "am.manager@example.test", role: "to_landlord_practical" }],
  cc: [
    { email: "am.team@example.test", role: "cc_landlord_team" },
    { email: "am.exec@example.test", role: "cc_landlord_exec" },
    { email: "lm.team@example.test", role: "cc_lm_team" },
    { email: "lm.exec@example.test", role: "cc_lm_exec" },
  ],
} as const;

export const demoWeeklyReportSections = {
  key_issue: "5F marketed area and floor plan revised after partial occupancy.",
  changes_since_last_report: [
    "Marketed area 300 py → 200 py",
    "Floor plan v1 → v2",
    "Rent-free 3 months → 2 months",
    "Supported parking 3 → 2",
  ],
  activity_summary: [
    "Broker requested current 5F package",
    "Revised package prepared after publication",
  ],
  negotiated_area_floor_changes: [
    "Marketed area 300 py → 200 py",
    "Floor plan v1 → v2",
  ],
  competitor_buildings: [],
  blocker_and_pending_approval: ["None after senior publication"],
  next_actions: [{
    action: "Confirm broker feedback on Monday",
    owner: "LM Manager",
    due_date: "2026-07-20",
  }],
} as const satisfies WeeklyReportSections;

export const demoWeeklyReportExpected = {
  id: "report-cobalt-2026-w29",
  building_id: "bld-cobalt",
  reporting_period: { from: "2026-07-13", to: "2026-07-18" },
  sections: demoWeeklyReportSections,
} as const;

const demoLeaseFlowReportSource: ReportSourceReference = {
  id: "activity-call-cobalt",
  source_type: "leaseflow_activity",
  building_id: "bld-cobalt",
  occurred_at: "2026-07-18T11:06:00+09:00",
  share_scope: "external_reportable",
  summary: "Broker requested current 5F package",
};

export function createDemoWeeklyReportDraftInput(): CreateWeeklyReportDraftInput {
  const recipients: ConfiguredReportRecipients = {
    configuration_id: demoWeeklyReportRecipientGroup.configuration_id,
    to: demoWeeklyReportRecipientGroup.to.map(({ email, role }) => ({ email, role })),
    cc: demoWeeklyReportRecipientGroup.cc.map(({ email, role }) => ({ email, role })),
  };
  return structuredClone({
    id: demoWeeklyReportExpected.id,
    building_id: demoWeeklyReportExpected.building_id,
    reporting_period: demoWeeklyReportExpected.reporting_period,
    sections: demoWeeklyReportExpected.sections,
    sources: [
      demoLeaseFlowReportSource,
      ...selectExternalReportableMockOutlook(demoMockOutlookMessages, "bld-cobalt"),
    ],
    attachments: [{
      id: "attachment-cobalt-plan-v2",
      building_id: "bld-cobalt",
      version_id: "file-cobalt-plan-v2",
      filename: "CFC_5F_plan_v2.svg",
    }],
    material_version_ids: [
      "av-cobalt-5f-v2",
      "term-cobalt-rf-v2",
      "term-cobalt-park-v2",
    ],
    recipients,
    cover: {
      subject: "[Weekly Report] Cobalt Finance Center 2026-07-13–2026-07-18",
      body: "Please find the approved building-specific weekly report attached.",
    },
  } satisfies CreateWeeklyReportDraftInput);
}

export function currentDemoWeeklyReportMaterialIds(
  input: CreateWeeklyReportDraftInput = createDemoWeeklyReportDraftInput(),
): Set<string> {
  return new Set([
    ...input.material_version_ids,
    ...input.attachments.map((attachment) => attachment.version_id),
    ...input.sources.map((source) => source.id),
  ]);
}
