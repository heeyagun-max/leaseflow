import { describe, expect, it } from "vitest";
import {
  canPerform,
  canSendExternal,
  selectCurrentFloorPlan,
  selectCurrentPublished,
  validateLandlordRecipients,
  type FileVersion,
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
