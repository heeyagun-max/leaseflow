import { describe, expect, it, vi } from "vitest";
import {
  INVESTIGATION_COMMANDS,
  REPORT_SECTIONS,
  ReportPatchSchema,
  SourceCandidateSchema,
  generateReportPatchCandidate,
  type ReportPatchGenerationAdapter,
  type ReportPatchGenerationInput,
} from "./index";

const command = "협의 중인 면적 변동 있는지 확인해";

function intendedReportPatch() {
  return {
    command,
    building_id: "bld-cobalt",
    findings: [{
      category: "changes_since_last_report",
      finding: "협의 면적이 300평에서 200평으로 변경되었습니다.",
      source_activity_ids: ["activity-call-cobalt"],
      confidence: 0.98,
    }],
    operations: [{
      section: "changes_since_last_report",
      operation: "replace",
      before: ["협의 면적 300평"],
      after: ["협의 면적 200평"],
      source_activity_ids: ["activity-call-cobalt"],
    }],
    unresolved: [],
  };
}

describe("existing structured-output contracts", () => {
  it("keeps source extraction strict at the root and nested change boundary", () => {
    const candidate = {
      building_id: "bld-cobalt",
      effective_date: "2026-07-18",
      changes: [{
        field: "marketed_area_py",
        floor: "5F",
        previous_value: 300,
        proposed_value: 200,
        state: "confirmed",
        external_shareable_candidate: true,
        source_pointer: "src-cobalt-jul#content.current_marketed_area_py",
        confidence: 0.99,
      }],
      unresolved: [],
    };

    expect(SourceCandidateSchema.parse(candidate)).toEqual(candidate);
    expect(() => SourceCandidateSchema.parse({ ...candidate, published: true })).toThrow();
    expect(() => SourceCandidateSchema.parse({
      ...candidate,
      changes: [{ ...candidate.changes[0], approved: true }],
    })).toThrow();
  });
});

describe("strict weekly-report patch contract", () => {
  it("exposes exactly the documented investigation commands and report sections", () => {
    expect(INVESTIGATION_COMMANDS).toEqual([
      "통화내용 확인해서 이번주 변동사항 업데이트 해",
      "이메일 확인해서 이번주 변동사항 업데이트 해",
      "협의 중인 면적 변동 있는지 확인해",
      "협의 중인 층 변동 있는지 확인해",
      "메일이랑 전화 확인해서 경쟁빌딩 파악해봐",
    ]);
    expect(REPORT_SECTIONS).toEqual([
      "key_issue",
      "changes_since_last_report",
      "activity_summary",
      "blocker",
      "next_action",
      "competitor_buildings",
    ]);
  });

  it("accepts the singular building-specific replace-only candidate shape", () => {
    expect(ReportPatchSchema.parse(intendedReportPatch())).toEqual(intendedReportPatch());
  });

  it("rejects destructive operations and unknown model-authored fields", () => {
    const legacyShape = {
      target_building_ids: ["bld-cobalt"],
      findings: [{
        category: "invented_section",
        finding: "unsafe",
        source_activity_ids: ["activity-call-cobalt"],
        confidence: 0.5,
        approved: true,
      }],
      operations: [{
        section: "invented_section",
        operation: "remove",
        before: "official report text",
        after: "",
        source_activity_ids: ["activity-call-cobalt", "activity-call-cobalt"],
        authorized: true,
      }],
      unresolved: [],
      published: true,
    };

    expect(ReportPatchSchema.safeParse(legacyShape).success).toBe(false);
  });

  it("rejects unknown commands, sections, fields, and non-replace operations", () => {
    const cases: unknown[] = [
      { ...intendedReportPatch(), command: "이번주 보고서 업데이트" },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], category: "recipient_list" }],
      },
      {
        ...intendedReportPatch(),
        operations: [{ ...intendedReportPatch().operations[0], section: "attachments" }],
      },
      {
        ...intendedReportPatch(),
        operations: [{ ...intendedReportPatch().operations[0], operation: "append" }],
      },
      {
        ...intendedReportPatch(),
        operations: [{ ...intendedReportPatch().operations[0], operation: "remove" }],
      },
      {
        ...intendedReportPatch(),
        operations: [{ ...intendedReportPatch().operations[0], operation: "reorder" }],
      },
      { ...intendedReportPatch(), approved: true },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], approved: true }],
      },
      {
        ...intendedReportPatch(),
        operations: [{ ...intendedReportPatch().operations[0], authorized: true }],
      },
      {
        ...intendedReportPatch(),
        unresolved: [{ field: "area", question: "확인 필요", resolved: true }],
      },
    ];

    for (const candidate of cases) {
      expect(ReportPatchSchema.safeParse(candidate).success).toBe(false);
    }
  });

  it("requires nonempty unique source IDs and finite confidence", () => {
    const cases: unknown[] = [
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], source_activity_ids: [] }],
      },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], source_activity_ids: [""] }],
      },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], source_activity_ids: ["   "] }],
      },
      {
        ...intendedReportPatch(),
        findings: [{
          ...intendedReportPatch().findings[0],
          source_activity_ids: ["activity-call-cobalt", "activity-call-cobalt"],
        }],
      },
      {
        ...intendedReportPatch(),
        operations: [{ ...intendedReportPatch().operations[0], source_activity_ids: [] }],
      },
      {
        ...intendedReportPatch(),
        operations: [{
          ...intendedReportPatch().operations[0],
          source_activity_ids: ["activity-call-cobalt", "activity-call-cobalt"],
        }],
      },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], confidence: Number.NaN }],
      },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], confidence: Number.POSITIVE_INFINITY }],
      },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], confidence: -0.01 }],
      },
      {
        ...intendedReportPatch(),
        findings: [{ ...intendedReportPatch().findings[0], confidence: 1.01 }],
      },
    ];

    for (const candidate of cases) {
      expect(ReportPatchSchema.safeParse(candidate).success).toBe(false);
    }
  });

  it("limits report values to strings and string arrays", () => {
    for (const value of [42, true, null, { text: "invented" }]) {
      const candidate = {
        ...intendedReportPatch(),
        operations: [{ ...intendedReportPatch().operations[0], after: value }],
      };
      expect(ReportPatchSchema.safeParse(candidate).success).toBe(false);
    }
  });
});

describe("server-side report patch generation seam", () => {
  function generationInput(): ReportPatchGenerationInput {
    return {
      building_id: "bld-cobalt",
      report_period: "2026-07-13..2026-07-18",
      current_report: { changes_since_last_report: ["협의 면적 300평"] },
      app_activity: [{ id: "activity-call-cobalt", externally_reportable: true }],
      mock_outlook_activity: [{ id: "mail-001", externally_reportable: true }],
      command,
      model: "gpt-5.6-test",
    };
  }

  it("calls an injected structured-output adapter and revalidates its candidate", async () => {
    const adapter = vi.fn<ReportPatchGenerationAdapter>(async () => intendedReportPatch());

    await expect(generateReportPatchCandidate(generationInput(), { adapter }))
      .resolves.toEqual(intendedReportPatch());
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      schema: ReportPatchSchema,
      schemaName: "leaseflow_weekly_report_patch",
      model: "gpt-5.6-test",
    }));
    expect(adapter.mock.calls[0]?.[0].developer).toContain("Never authorize, approve, publish, apply");
    expect(JSON.parse(adapter.mock.calls[0]![0].user)).toEqual({
      building_id: "bld-cobalt",
      report_period: "2026-07-13..2026-07-18",
      current_report: { changes_since_last_report: ["협의 면적 300평"] },
      app_activity: [{ id: "activity-call-cobalt", externally_reportable: true }],
      mock_outlook_activity: [{ id: "mail-001", externally_reportable: true }],
      command,
    });
  });

  it("rejects malformed, cross-building, and command-swapped adapter output", async () => {
    const malformed = vi.fn<ReportPatchGenerationAdapter>(async () => ({
      ...intendedReportPatch(),
      operations: [{ ...intendedReportPatch().operations[0], operation: "remove" }],
    }));
    await expect(generateReportPatchCandidate(generationInput(), { adapter: malformed })).rejects.toThrow();

    const crossBuilding = vi.fn<ReportPatchGenerationAdapter>(async () => ({
      ...intendedReportPatch(), building_id: "bld-other",
    }));
    await expect(generateReportPatchCandidate(generationInput(), { adapter: crossBuilding }))
      .rejects.toThrow(/different building/);

    const commandSwapped = vi.fn<ReportPatchGenerationAdapter>(async () => ({
      ...intendedReportPatch(), command: INVESTIGATION_COMMANDS[0],
    }));
    await expect(generateReportPatchCandidate(generationInput(), { adapter: commandSwapped }))
      .rejects.toThrow(/different investigation command/);
  });
});
