import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canPerform,
  canSendExternal,
  confirmCandidates,
  publishConfirmedBatch,
  recordExtraction,
  selectCurrentFloorPlan,
  selectCurrentPublished,
  validateLandlordRecipients,
  type CandidateChange,
  type FileVersion,
  type GovernedPublicationState,
  type VersionedRecord,
} from "./index";

const versions: VersionedRecord[] = [
  {id:"v1", building_id:"b1", version_no:1, status:"superseded", valid_from:"2026-06-01", valid_to:"2026-07-17", superseded:true, external_shareable:true},
  {id:"v2", building_id:"b1", version_no:2, status:"published", valid_from:"2026-07-18", valid_to:null, superseded:false, external_shareable:true},
];

describe("governed version selection", () => {
  it("selects only the current published version", () => {
    expect(selectCurrentPublished(versions, new Date("2026-07-18T00:00:00Z"))?.id).toBe("v2");
  });

  it("fails closed when more than one current published version exists", () => {
    expect(() => selectCurrentPublished([
      {...versions[1]!, id:"duplicate"},
      versions[1]!,
    ], new Date("2026-07-18T00:00:00Z"))).toThrow(/multiple current published/);
  });

  it("blocks a superseded floor plan", () => {
    const files: FileVersion[] = [
      {...versions[0]!, floor:"5F", filename:"plan-v1.svg"},
      {...versions[1]!, floor:"5F", filename:"plan-v2.svg"},
    ];
    expect(selectCurrentFloorPlan(files, "b1", "5F", new Date("2026-07-18T00:00:00Z")).filename).toBe("plan-v2.svg");
  });

  it("separates junior confirmation from senior publication", () => {
    expect(canPerform("data_steward", "candidate.confirm")).toBe(true);
    expect(canPerform("data_steward", "record.publish")).toBe(false);
    expect(canPerform("senior_reviewer", "record.publish")).toBe(true);
  });

  it("requires landlord and LM recipient roles", () => {
    expect(() => validateLandlordRecipients({
      to:[{email:"a@example.test", role:"to_landlord_practical"}],
      cc:[
        {email:"b@example.test", role:"cc_landlord_team"},
        {email:"c@example.test", role:"cc_landlord_exec"},
        {email:"d@example.test", role:"cc_lm_team"},
        {email:"e@example.test", role:"cc_lm_exec"},
      ],
    })).not.toThrow();
  });

  it("blocks send until approval and clean records", () => {
    expect(canSendExternal({approved:true, unresolvedCount:0, facts:[versions[1]!], files:[versions[1]!]})).toBe(true);
    expect(canSendExternal({approved:false, unresolvedCount:0, facts:[versions[1]!], files:[versions[1]!]})).toBe(false);
  });
});

interface TestRecord extends VersionedRecord {
  floor: string;
  field: "marketed_area_py" | "rent_free_months" | "supported_parking_spaces";
  value: number;
}

interface TestFile extends FileVersion {
  file_type: "floor_plan";
}

function workflowState(): GovernedPublicationState<TestRecord, TestFile> {
  return {
    revision: 0,
    effective_date: "2026-07-18",
    publication_scope: { building_id: "b1", floor: "5F" },
    stage: "source_uploaded",
    candidates: [],
    records: [
      {id:"area-v1",building_id:"b1",floor:"5F",field:"marketed_area_py",value:300,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"area-v2",building_id:"b1",floor:"5F",field:"marketed_area_py",value:200,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"rf-v1",building_id:"b1",floor:"5F",field:"rent_free_months",value:3,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"rf-v2",building_id:"b1",floor:"5F",field:"rent_free_months",value:2,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"park-v1",building_id:"b1",floor:"5F",field:"supported_parking_spaces",value:3,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"park-v2",building_id:"b1",floor:"5F",field:"supported_parking_spaces",value:2,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-area-v1",building_id:"b2",floor:"5F",field:"marketed_area_py",value:900,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-area-v2",building_id:"b2",floor:"5F",field:"marketed_area_py",value:800,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
    ],
    files: [
      {id:"plan-v1",building_id:"b1",floor:"5F",filename:"plan-v1.svg",file_type:"floor_plan",version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"plan-v2",building_id:"b1",floor:"5F",filename:"plan-v2.svg",file_type:"floor_plan",version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-plan-v1",building_id:"b2",floor:"5F",filename:"other-plan-v1.svg",file_type:"floor_plan",version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-plan-v2",building_id:"b2",floor:"5F",filename:"other-plan-v2.svg",file_type:"floor_plan",version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
    ],
    audit: [],
  };
}

function publicationCandidate(
  input: Omit<CandidateChange, "source_state" | "source_pointer" | "confidence" | "external_shareable_candidate" | "status">,
): CandidateChange {
  return {
    ...input,
    source_state: "confirmed",
    source_pointer: "source / 5F",
    confidence: 0.99,
    external_shareable_candidate: true,
    status: "candidate",
  };
}

const candidates: CandidateChange[] = [
  publicationCandidate({id:"c-area",building_id:"b1",field:"marketed_area_py",floor:"5F",target_type:"record",predecessor_version_id:"area-v1",candidate_version_id:"area-v2",previous_value:300,proposed_value:200}),
  publicationCandidate({id:"c-plan",building_id:"b1",field:"floor_plan",floor:"5F",target_type:"file",predecessor_version_id:"plan-v1",candidate_version_id:"plan-v2",previous_value:"plan-v1.svg",proposed_value:"plan-v2.svg"}),
  publicationCandidate({id:"c-rf",building_id:"b1",field:"rent_free_months",floor:"5F",target_type:"record",predecessor_version_id:"rf-v1",candidate_version_id:"rf-v2",previous_value:3,proposed_value:2}),
  publicationCandidate({id:"c-park",building_id:"b1",field:"supported_parking_spaces",floor:"5F",target_type:"record",predecessor_version_id:"park-v1",candidate_version_id:"park-v2",previous_value:3,proposed_value:2}),
];

describe("publication state machine", () => {
  it("allows only legal consecutive transitions", () => {
    expect(() => assertTransition("source_uploaded", "extracted_candidate")).not.toThrow();
    expect(() => assertTransition("source_uploaded", "published")).toThrow(/Illegal publication transition/);
    expect(() => assertTransition("published", "junior_confirmed")).toThrow(/Illegal publication transition/);
  });

  it("does not mutate state when a junior attempts publication", () => {
    const extracted = recordExtraction(workflowState(), candidates, {id:"junior",role:"data_steward"}, "2026-07-18T09:00:00.000Z");
    const confirmed = confirmCandidates(extracted, {id:"junior",role:"data_steward"}, "2026-07-18T09:01:00.000Z");
    const before = structuredClone(confirmed);
    expect(() => publishConfirmedBatch(confirmed, {id:"junior",role:"data_steward"}, "2026-07-18T09:02:00.000Z")).toThrow(/not allowed/);
    expect(confirmed).toEqual(before);
  });

  it("publishes only the four targeted versions and leaves another building untouched", () => {
    const extracted = recordExtraction(workflowState(), candidates, {id:"junior",role:"data_steward"}, "2026-07-18T09:00:00.000Z");
    const confirmed = confirmCandidates(extracted, {id:"junior",role:"data_steward"}, "2026-07-18T09:01:00.000Z");
    const unrelatedRecords = confirmed.records.filter((record) => record.building_id === "b2");
    const unrelatedFiles = confirmed.files.filter((file) => file.building_id === "b2");
    const published = publishConfirmedBatch(confirmed, {id:"senior",role:"senior_reviewer"}, "2026-07-18T09:02:00.000Z");
    expect(published.stage).toBe("published");
    expect(published.revision).toBe(3);
    expect(published.records.filter((record) => record.building_id === "b1" && record.version_no === 1)
      .every((record) => record.status === "superseded" && record.superseded && record.valid_to === "2026-07-17")).toBe(true);
    expect(published.records.filter((record) => record.building_id === "b1" && record.version_no === 2)
      .every((record) => record.status === "published" && !record.superseded)).toBe(true);
    expect(published.records.filter((record) => record.building_id === "b2")).toEqual(unrelatedRecords);
    expect(published.files.filter((file) => file.building_id === "b2")).toEqual(unrelatedFiles);
    expect(published.audit.map((event) => event.event_type)).toEqual([
      "source.extracted", "candidate.confirmed", "batch.senior_approved", "batch.published",
    ]);
  });

  it("rejects incomplete, mismatched, or non-shareable publication candidates", () => {
    const extracted = recordExtraction(workflowState(), candidates, {id:"junior",role:"data_steward"}, "2026-07-18T09:00:00.000Z");
    const confirmed = confirmCandidates(extracted, {id:"junior",role:"data_steward"}, "2026-07-18T09:01:00.000Z");
    expect(() => publishConfirmedBatch(
      { ...confirmed, candidates: confirmed.candidates.slice(0, 3) },
      {id:"senior",role:"senior_reviewer"},
      "2026-07-18T09:02:00.000Z",
    )).toThrow(/exactly 4/);
    expect(() => publishConfirmedBatch(
      { ...confirmed, candidates: confirmed.candidates.map((candidate) => candidate.field === "marketed_area_py" ? { ...candidate, proposed_value: 999 } : candidate) },
      {id:"senior",role:"senior_reviewer"},
      "2026-07-18T09:02:00.000Z",
    )).toThrow(/proposed value/);
    expect(() => publishConfirmedBatch(
      { ...confirmed, candidates: confirmed.candidates.map((candidate) => candidate.field === "floor_plan" ? { ...candidate, external_shareable_candidate: false } : candidate) },
      {id:"senior",role:"senior_reviewer"},
      "2026-07-18T09:02:00.000Z",
    )).toThrow(/not confirmed and shareable/);
  });
});
