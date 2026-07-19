import { describe, expect, it } from "vitest";
import type { PublicReport } from "@/components/governance/admin-data";
import { buildReportMutationBody, selectReportByRef } from "./report-console";

describe("report console boundaries", () => {
  it("sends the globally selected actor without substituting the LM Manager", () => {
    expect(buildReportMutationBody({
      action: "approve",
      actorId: "usr-senior",
      reportId: "report-cobalt-2026-w29",
      revision: 9,
    })).toEqual({
      action: "approve",
      actor_id: "usr-senior",
      expected_revision: 9,
      report_id: "report-cobalt-2026-w29",
    });
  });

  it("fails closed when a report reference is not in the fetched workflow", () => {
    const reports = [{ id: "report-cobalt-2026-w29" }] as PublicReport[];
    expect(selectReportByRef(reports, "unknown-report")).toBeUndefined();
    expect(selectReportByRef(reports, "report-cobalt-2026-w29")).toBe(reports[0]);
  });
});
