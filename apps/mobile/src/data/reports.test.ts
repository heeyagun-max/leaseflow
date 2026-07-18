import { describe, expect, it, vi } from "vitest";
import {
  ReportWorkflowHttpError,
  fetchMobileReports,
  mutateMobileReports,
  reportWorkflowRefreshRevision,
  requiresReportWorkflowRefresh,
  type MobileReportWorkflowView,
} from "./reports";

const view = {
  revision: 9,
  publication_stage: "published",
  reports: [{
    id: "report-1",
    building_id: "bld-cobalt",
    reporting_period: { from: "2026-07-13", to: "2026-07-18" },
    status: "patch_pending",
    sections: {
      key_issue: "5F marketed area and floor plan revised after partial occupancy.",
      changes_since_last_report: [],
      activity_summary: [],
      negotiated_area_floor_changes: [],
      competitor_buildings: [],
      blocker_and_pending_approval: [],
      next_actions: [],
    },
    sources: [],
    attachments: [],
    recipients: { configuration_id: "recipient-group-1", to: [], cc: [] },
    cover: { subject: "Weekly report", body: "Synthetic demo report" },
    unresolved: [],
    pending_candidate: {
      id: "patch-1",
      command: "이메일 확인해서 이번주 변동사항 업데이트 해",
      findings: [],
      operations: [{
        section: "blocker_and_pending_approval",
        operation: "append",
        before: [],
        after: ["Await landlord feedback"],
        source_reference_ids: ["mail-001"],
      }],
      unresolved: [],
    },
    accepted_patch_count: 0,
    approval: { approved: false, approved_at: null },
    delivery: { sent: false, sent_at: null },
  }],
  activities: [],
  audit: [],
  labels: { mode: "DEMO", role: "LM Manager", delivery: "SANDBOX ONLY" },
} as const satisfies MobileReportWorkflowView;

describe("mobile weekly report HTTP adapter", () => {
  it("loads the curated report view from the normalized base URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(view), { status: 200 }));
    await expect(fetchMobileReports({ baseUrl: "https://demo.example/", fetcher })).resolves.toEqual(view);
    expect(view.reports[0]?.pending_candidate?.operations[0]).toMatchObject({
      section: "blocker_and_pending_approval",
      operation: "append",
    });
    expect(fetcher).toHaveBeenCalledWith("https://demo.example/api/mobile/reports", {
      headers: { Accept: "application/json" },
    });
  });

  it("always sends the synthetic LM Manager actor and expected revision", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(view), { status: 200 }));
    await mutateMobileReports(9, { action: "approve", report_id: "report-1" }, {
      baseUrl: "https://demo.example",
      fetcher,
    });
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      action: "approve",
      report_id: "report-1",
      actor_id: "usr-manager",
      expected_revision: 9,
    });
  });

  it("surfaces the structured server error without losing conflict metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "REVISION_CONFLICT",
      error: "Revision conflict",
      current_revision: 12,
    }), { status: 409 }));
    const promise = fetchMobileReports({ fetcher });
    await expect(promise).rejects.toBeInstanceOf(ReportWorkflowHttpError);
    await expect(promise).rejects.toMatchObject({
      message: "Revision conflict",
      status: 409,
      code: "REVISION_CONFLICT",
      currentRevision: 12,
    });
  });

  it("requires a refresh for stale and revision-conflict responses while preserving current_revision", async () => {
    const staleFetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "WORKFLOW_STALE",
      error: "Weekly report sources changed",
      current_revision: 15,
    }), { status: 409 }));

    let caught: unknown;
    try {
      await fetchMobileReports({ fetcher: staleFetcher });
    } catch (error) {
      caught = error;
    }

    expect(requiresReportWorkflowRefresh(caught)).toBe(true);
    expect(caught).toMatchObject({
      code: "WORKFLOW_STALE",
      currentRevision: 15,
    });
    expect(reportWorkflowRefreshRevision(caught)).toBe(15);
    expect(requiresReportWorkflowRefresh(new ReportWorkflowHttpError(409, {
      code: "REVISION_CONFLICT",
      error: "Revision conflict",
      current_revision: 16,
    }))).toBe(true);
    expect(requiresReportWorkflowRefresh(new ReportWorkflowHttpError(409, {
      code: "WORKFLOW_CONFLICT",
      error: "Stage 2 publication is required",
      current_revision: 15,
    }))).toBe(false);
    expect(reportWorkflowRefreshRevision(new ReportWorkflowHttpError(409, {
      code: "WORKFLOW_STALE",
      error: "Sources changed",
    }))).toBeNull();
  });
});
