import { describe, expect, it } from "vitest";
import { DemoStateCorruptError, WeeklyReportStaleError } from "./demo-store.server";
import { classifyWorkflowError } from "./workflow-error.server";

describe("workflow error classification", () => {
  it("maps weekly-report idempotency collisions to a stable conflict", () => {
    expect(classifyWorkflowError(new Error(
      "Idempotency key is already assigned to another weekly report.",
    ))).toEqual({
      status: 409,
      body: {
        code: "IDEMPOTENCY_CONFLICT",
        error: "Idempotency key is already assigned to another weekly report.",
      },
    });
  });

  it("returns the authoritative revision after report inputs become stale", () => {
    expect(classifyWorkflowError(new WeeklyReportStaleError(17))).toEqual({
      status: 409,
      body: {
        code: "WORKFLOW_STALE",
        error: "Weekly report inputs changed. Reload the current state before continuing.",
        current_revision: 17,
      },
    });
  });

  it("does not expose persistence details or unknown server errors", () => {
    expect(classifyWorkflowError(new DemoStateCorruptError("/private/demo/state.json is invalid"))).toEqual({
      status: 500,
      body: { code: "STATE_CORRUPT", error: "Demo state is unavailable." },
    });
    expect(classifyWorkflowError(new Error("ENOENT: /private/demo/recipient_group.json"))).toEqual({
      status: 500,
      body: { code: "INTERNAL_ERROR", error: "The workflow could not be completed." },
    });
  });
});
