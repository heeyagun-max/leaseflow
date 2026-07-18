import {
  createInitialOperationalState,
  EXPECTED_PUBLICATION_FIELDS,
  requireExternalRecord,
  selectCurrentFloorPlan,
  selectCurrentPublished,
  type CandidateChange,
  type ExpectedPublicationField,
  type FileVersion,
  type GovernedPublicationState,
  type DraftMaterial,
  type OperationalState,
  type UserRole,
  type VersionedRecord,
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

export interface DemoState extends GovernedPublicationState<DemoRecord, DemoFileVersion> {
  schema_version: 2;
  source_id: "src-cobalt-jul";
  operations: OperationalState;
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
    schema_version: 2,
    source_id: "src-cobalt-jul",
    revision: 0,
    effective_date: demoSourceUpdate.effectiveDate,
    publication_scope: { building_id: "bld-cobalt", floor: "5F" },
    stage: "source_uploaded",
    candidates: [],
    records: initialRecords,
    files: initialFiles,
    audit: [],
    operations: createInitialOperationalState(),
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
