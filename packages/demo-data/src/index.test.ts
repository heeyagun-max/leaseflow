import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { createInitialWeeklyReportState, createWeeklyReportDraft } from "@leaseflow/domain";

import {
  createDemoWeeklyReportDraftInput,
  createInitialDemoState,
  currentDemoWeeklyReportMaterialIds,
  demoMockOutlookMessages,
  demoWeeklyReportRecipientGroup,
  migrateDemoStateToV3,
  selectExternalReportableMockOutlook,
  type LegacyDemoStateV2,
} from "./index";

const fixtureRoot = fileURLToPath(new URL("../../../data/demo/", import.meta.url));

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(`${fixtureRoot}${name}`, "utf8"));
}

describe("persistent demo state schema v3", () => {
  it("seeds an empty governed weekly-report state without changing the existing operation collections", () => {
    const state = createInitialDemoState();

    expect(state.schema_version).toBe(3);
    expect(state.operations).toMatchObject({
      requests: [],
      packages: [],
      activities: [],
      audit: [],
      reports: { reports: [], activities: [], audit: [] },
    });
  });

  it("upgrades schema v2 losslessly and does not mutate the supplied state", () => {
    const current = createInitialDemoState();
    const { reports: _reports, ...legacyOperations } = current.operations;
    const legacy = {
      ...structuredClone(current),
      schema_version: 2,
      operations: legacyOperations,
    } satisfies LegacyDemoStateV2;
    legacy.operations.requests.push({
      id: "request-preserved",
      source: "call",
      source_id: "call-preserved",
      raw_text: "synthetic request",
      extraction: {
        language: "en",
        building_mentions: [],
        floor: null,
        requested_fields: [],
        requested_files: [],
        recipient: { name: null, organization: null },
        deadline: null,
        ambiguities: [],
      },
      status: "candidate",
      imported_at: "2026-07-18T00:00:00.000Z",
      confirmed_at: null,
    });

    const migrated = migrateDemoStateToV3(legacy);

    expect(migrated.schema_version).toBe(3);
    expect(migrated.operations.requests).toEqual(legacy.operations.requests);
    expect(migrated.operations.reports).toEqual({ reports: [], activities: [], audit: [] });
    expect("reports" in legacy.operations).toBe(false);
  });
});

describe("weekly report synthetic fixtures", () => {
  it("keeps the checked-in fixture files aligned with the typed exports", () => {
    expect(readFixture("mock_outlook.json")).toEqual(demoMockOutlookMessages);
    expect(readFixture("recipient_group.json")).toEqual(demoWeeklyReportRecipientGroup);
  });

  it("fails closed so confidential Outlook content never enters report sources or serialized model input", () => {
    const sources = selectExternalReportableMockOutlook(demoMockOutlookMessages, "bld-cobalt");
    const serialized = JSON.stringify({
      sources,
      report: createDemoWeeklyReportDraftInput(),
    });

    expect(sources.map((source) => source.id)).toEqual(["mail-001", "mail-003"]);
    expect(serialized).not.toContain("mail-002");
    expect(serialized).not.toContain("Revised incentives and parking support");
    expect(serialized).not.toContain("Senior approval is pending");
  });

  it("preserves the exact configured recipient order and golden base report", () => {
    const input = createDemoWeeklyReportDraftInput();

    expect(input.recipients.to.map(({ email }) => email)).toEqual([
      "am.manager@example.test",
    ]);
    expect(input.recipients.cc.map(({ email }) => email)).toEqual([
      "am.team@example.test",
      "am.exec@example.test",
      "lm.team@example.test",
      "lm.exec@example.test",
    ]);
    expect(input.sections).toEqual({
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
    });
    expect(readFixture("weekly_report_expected.json")).toEqual({
      id: input.id,
      building_id: input.building_id,
      reporting_period: input.reporting_period,
      sections: input.sections,
    });
  });

  it("uses both LeaseFlow and mock Outlook sources but never references the confidential mail", () => {
    const input = createDemoWeeklyReportDraftInput();

    expect(input.sources.map((source) => source.source_type)).toContain("leaseflow_activity");
    expect(input.sources.map((source) => source.source_type)).toContain("mock_outlook");
    expect(input.sources.map((source) => source.id)).toEqual([
      "activity-call-cobalt",
      "mail-001",
      "mail-003",
    ]);
  });

  it("produces a domain-valid draft input and complete approval material set", () => {
    const input = createDemoWeeklyReportDraftInput();
    const state = createWeeklyReportDraft(
      createInitialWeeklyReportState(),
      input,
      currentDemoWeeklyReportMaterialIds(input),
      { id: "usr-member", role: "lm_member" },
      "2026-07-18T12:05:00.000Z",
    );

    expect(state.reports[0]).toMatchObject({
      id: "report-cobalt-2026-w29",
      building_id: "bld-cobalt",
      status: "draft",
      current_sections: input.sections,
    });
  });
});
