import { describe, expect, it } from "vitest";
import {
  assertTransition,
  approveOperationalPackage,
  canPerform,
  canSendExternal,
  confirmCandidates,
  confirmOperationalRequest,
  createInitialOperationalState,
  decidePackageEdit,
  draftOperationalPackage,
  importOperationalRequest,
  publishConfirmedBatch,
  proposePackageEdit,
  recordExtraction,
  renderOperationalPackageBody,
  selectCurrentFloorPlan,
  selectCurrentPublished,
  sendOperationalPackage,
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
    expect(canPerform("lm_manager", "package.send")).toBe(true);
    expect(canPerform("lm_member", "package.send")).toBe(false);
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

describe("mobile request-to-package state machine", () => {
  const manager = { id: "manager", role: "lm_manager" as const };
  const extraction = {
    language: "ko" as const,
    building_mentions: [{ text: "Cobalt", resolved_building_id: "bld-cobalt", confidence: 0.99 }],
    floor: "5F", requested_fields: ["marketed_area", "rent_free", "supported_parking"] as const,
    requested_files: ["current_floor_plan"] as const,
    recipient: { name: "Alex", organization: "Northbridge" }, deadline: "today afternoon", ambiguities: [],
  };
  const material = {
    building_id: "bld-cobalt", building_name: "Cobalt Finance Center", floor: "5F",
    facts: [
      { field: "marketed_area" as const, label: "Marketed area", value: 200, unit: "py" as const, version_id: "area-v2", source_pointer: "published availability" },
      { field: "rent_free" as const, label: "Rent-free", value: 2, unit: "months" as const, version_id: "rf-v2", source_pointer: "published terms" },
      { field: "supported_parking" as const, label: "Supported parking", value: 2, unit: "spaces" as const, version_id: "park-v2", source_pointer: "published terms" },
    ],
    files: [{ requested_file: "current_floor_plan" as const, filename: "plan-v2.svg", version_id: "plan-v2", source_pointer: "published files" }],
  };

  function drafted() {
    const imported = importOperationalRequest(createInitialOperationalState(), {
      id: "req-1", source: "call", source_id: "call-1", raw_text: "request", extraction: { ...extraction, requested_fields: [...extraction.requested_fields], requested_files: [...extraction.requested_files] },
    }, manager, "2026-07-18T01:00:00.000Z");
    const confirmed = confirmOperationalRequest(imported, "req-1", manager, "2026-07-18T01:01:00.000Z");
    return draftOperationalPackage(confirmed, "req-1", material, {
      to: ["configured@example.test"], cc: ["manager@example.test"], configuration_id: "config-1",
    }, manager, "2026-07-18T01:02:00.000Z");
  }

  it("blocks ambiguous confirmation and non-manager approval", () => {
    const imported = importOperationalRequest(createInitialOperationalState(), {
      id: "req-ambiguous", source: "email", source_id: "email-1", raw_text: "which building", extraction: {
        ...extraction, requested_fields: [...extraction.requested_fields], requested_files: [...extraction.requested_files],
        ambiguities: [{ field: "building", reason: "not resolved" }],
      },
    }, manager, "2026-07-18T01:00:00.000Z");
    expect(() => confirmOperationalRequest(imported, "req-ambiguous", manager, "2026-07-18T01:01:00.000Z")).toThrow(/ambiguities/);
    expect(() => approveOperationalPackage(drafted(), "pkg-req-1", { id: "member", role: "lm_member" }, "2026-07-18T01:03:00.000Z")).toThrow(/not allowed/);
  });

  it("protects package facts/files/recipients during subject-body edit", () => {
    const before = drafted();
    const pkg = before.packages[0]!;
    const courteous = renderOperationalPackageBody(pkg.facts, pkg.files, "concise_courteous");
    const proposed = proposePackageEdit(before, "pkg-req-1", { subject: pkg.subject, body: courteous, instruction: "make concise" }, manager, "2026-07-18T01:03:00.000Z");
    const accepted = decidePackageEdit(proposed, "pkg-req-1", "accept", manager, "2026-07-18T01:04:00.000Z");
    expect(accepted.packages[0]).toMatchObject({ subject: pkg.subject, body: courteous });
    expect(accepted.packages[0]?.facts).toEqual(before.packages[0]?.facts);
    expect(accepted.packages[0]?.files).toEqual(before.packages[0]?.files);
    expect(accepted.packages[0]?.recipients).toEqual(before.packages[0]?.recipients);
    for (const malicious of [courteous.replace("200 py", "300 py"), courteous.replace(/^Attachment:.*$/m, ""), `${courteous}\nInvented term: 12 months`]) {
      expect(() => proposePackageEdit(before, "pkg-req-1", { subject: pkg.subject, body: malicious, instruction: "attack" }, manager, "2026-07-18T01:03:00.000Z")).toThrow(/protected|alter/);
      expect(before.packages[0]).toEqual(pkg);
    }
  });

  it("requires approval and current versions, then sends exactly once", () => {
    const draft = drafted();
    const current = new Set(["area-v2", "rf-v2", "park-v2", "plan-v2"]);
    expect(() => sendOperationalPackage(draft, "pkg-req-1", "send-key-1", current, manager, "2026-07-18T01:04:00.000Z")).toThrow(/approval/);
    const approved = approveOperationalPackage(draft, "pkg-req-1", manager, "2026-07-18T01:04:00.000Z");
    expect(() => sendOperationalPackage(approved, "pkg-req-1", "send-key-1", new Set(["area-v1"]), manager, "2026-07-18T01:05:00.000Z")).toThrow(/stale/);
    const sent = sendOperationalPackage(approved, "pkg-req-1", "send-key-1", current, manager, "2026-07-18T01:05:00.000Z");
    expect(sent.activities).toHaveLength(1);
    expect(sendOperationalPackage(sent, "pkg-req-1", "send-key-1", current, manager, "2026-07-18T01:06:00.000Z")).toBe(sent);

    const second = { ...approved, packages: [...approved.packages, { ...approved.packages[0]!, id: "pkg-req-2", request_id: "req-2" }] };
    const firstSent = sendOperationalPackage(second, "pkg-req-1", "global-key", current, manager, "2026-07-18T01:07:00.000Z");
    expect(() => sendOperationalPackage(firstSent, "pkg-req-2", "global-key", current, manager, "2026-07-18T01:08:00.000Z")).toThrow(/another package/);
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
