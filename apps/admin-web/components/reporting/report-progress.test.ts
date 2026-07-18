import { describe, expect, it } from "vitest";
import { reportLifecycleStepState, type ReportLifecycleStep } from "./report-progress";

const steps: ReportLifecycleStep[] = ["draft", "investigate", "approve", "send"];

function states(progress: Parameters<typeof reportLifecycleStepState>[0]) {
  return steps.map((step) => reportLifecycleStepState(progress, step));
}

describe("reportLifecycleStepState", () => {
  it("keeps investigation current while a draft has no accepted patch", () => {
    expect(states({ acceptedPatchCount: 0, hasPendingCandidate: false, status: "draft" }))
      .toEqual(["complete", "current", "pending", "pending"]);
  });

  it("keeps investigation current while a candidate awaits a decision", () => {
    expect(states({ acceptedPatchCount: 0, hasPendingCandidate: true, status: "patch_pending" }))
      .toEqual(["complete", "current", "pending", "pending"]);
  });

  it("moves to LM approval after a scoped patch is accepted", () => {
    expect(states({ acceptedPatchCount: 1, hasPendingCandidate: false, status: "draft" }))
      .toEqual(["complete", "complete", "current", "pending"]);
  });

  it("moves to sandbox delivery after LM approval", () => {
    expect(states({ acceptedPatchCount: 1, hasPendingCandidate: false, status: "approved" }))
      .toEqual(["complete", "complete", "complete", "current"]);
  });

  it("marks every lifecycle step complete after sandbox delivery", () => {
    expect(states({ acceptedPatchCount: 1, hasPendingCandidate: false, status: "sent" }))
      .toEqual(["complete", "complete", "complete", "complete"]);
  });

  it("blocks a stale report at the draft boundary", () => {
    expect(states({ acceptedPatchCount: 1, hasPendingCandidate: false, status: "stale" }))
      .toEqual(["blocked", "pending", "pending", "pending"]);
  });
});
