import { describe, expect, it } from "vitest";
import { INVESTIGATION_COMMANDS } from "@leaseflow/ai";
import {
  createInitialWeeklyReportState,
  createWeeklyReportDraft,
} from "@leaseflow/domain";
import {
  createDemoWeeklyReportDraftInput,
  currentDemoWeeklyReportMaterialIds,
} from "@leaseflow/demo-data";
import { createWeeklyReportPatchCandidate } from "./report-patch.server";

function reportFixture() {
  const input = createDemoWeeklyReportDraftInput();
  return createWeeklyReportDraft(
    createInitialWeeklyReportState(),
    input,
    currentDemoWeeklyReportMaterialIds(input),
    { id: "usr-manager", role: "lm_manager" },
    "2026-07-18T10:00:00.000Z",
  ).reports[0]!;
}

describe("weekly report patch service", () => {
  it("supports all five exact Korean commands as candidate-only demo patches", async () => {
    const report = reportFixture();
    for (const command of INVESTIGATION_COMMANDS) {
      const result = await createWeeklyReportPatchCandidate(report, command, {
        environment: { DEMO_MODE: "true" },
        adapter: async () => { throw new Error("demo fallback must not call a live adapter"); },
      });
      expect(result.mode).toBe("credential_free_demo");
      expect(result.candidate).toMatchObject({
        command,
        target_building_ids: ["bld-cobalt"],
      });
      expect(result.candidate.findings.length).toBeGreaterThan(0);
      expect(result.candidate.operations.length).toBeGreaterThan(0);
      expect(result.candidate.findings.every((finding) =>
        finding.source_reference_ids.length > 0
          && finding.confidence >= 0
          && finding.confidence <= 1)).toBe(true);
      expect(JSON.stringify(result.candidate)).not.toContain("mail-002");
    }
  });

  it("rejects a live adapter candidate that cites a source outside the curated report", async () => {
    const report = reportFixture();
    await expect(createWeeklyReportPatchCandidate(
      report,
      "이메일 확인해서 이번주 변동사항 업데이트 해",
      {
        environment: { DEMO_MODE: "false", OPENAI_API_KEY: "synthetic", OPENAI_MODEL: "gpt-test" },
        adapter: async () => ({
          command: "이메일 확인해서 이번주 변동사항 업데이트 해",
          building_id: "bld-cobalt",
          findings: [{ category: "activity_summary", finding: "forged", source_activity_ids: ["mail-002"], confidence: 0.9 }],
          operations: [{ section: "activity_summary", operation: "replace",
            before: report.current_sections.activity_summary,
            after: [...report.current_sections.activity_summary, "forged"],
            source_activity_ids: ["mail-002"] }],
          unresolved: [],
        }),
      },
    )).rejects.toThrow(/unavailable source mail-002/);
  });
});
