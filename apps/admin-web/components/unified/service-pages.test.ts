import { describe, expect, it } from "vitest";
import { defaultWeeklyAutomation } from "@/lib/weekly-settings-schema";
import {
  draftWeeklyBuildingReport,
  filterAndSortBuildings,
  formatWeeklyMeeting,
  loadOperationsSnapshot,
  loadWeeklyGroups,
  interpretHomeRequest,
  latestBuildingDetails,
  formatRequestDeadline,
  matchesBuildingSearch,
  nextWorkAction,
  performOperationsWorkflowAction,
  performWeeklyReportAction,
  publishedDocumentsForBuilding,
  publishedFacts,
  reportsForGroup,
  weeklyChildrenForGroup,
  weeklyAttentionCount,
  weeklyAutomationSummary,
  type OperationsSnapshot,
  type OperationsWorkflow,
  type PublishedDocumentReference,
  type PublicBuildingSummary,
  type WeeklyOperationalGroup,
} from "./service-pages";

function workflow(revision: number): OperationsWorkflow {
  return { revision, publication_stage: "published", requests: [], packages: [], activities: [], audit: [] };
}

describe("unified service projections", () => {
  const cobaltBuilding: PublicBuildingSummary = {
    building_id: "bld-cobalt",
    building_name: "Cobalt Finance Center",
    search_aliases: ["코발트 파이낸스 센터", "CFC"],
    landlord_name: "한빛자산운용",
    market: "CBD",
    latest_changed_at: "2026-07-18T09:00:00+09:00",
    available_floors: ["5F"],
    marketed_area_py: 300,
    availability: "즉시",
  };

  it("renders building facts from the already-filtered published projection", () => {
    const result = publishedFacts({ marketed_area_py: 200, rent_free_months: 3, supported_parking_spaces: 4 } as never);
    expect(result).toEqual([
      { field: "marketed_area_py", value: 200 },
      { field: "rent_free_months", value: 3 },
      { field: "supported_parking_spaces", value: 4 },
    ]);
  });

  it("shows the complete latest building information without internal workflow labels", () => {
    const details = latestBuildingDetails(cobaltBuilding, {
      floor: "5F",
      marketed_area_py: 200,
      rent_free_months: 2,
      supported_parking_spaces: 2,
    } as never);

    expect(details).toEqual([
      { label: "Landlord", value: "한빛자산운용" },
      { label: "Market", value: "CBD" },
      { label: "Available floors", value: "5F" },
      { label: "Available area", value: "200 py" },
      { label: "Availability", value: "즉시" },
      { label: "Rent-free", value: "2 months" },
      { label: "Supported parking", value: "2 spaces" },
      { label: "Latest update", value: "Updated Jul 18" },
    ]);
    expect(details.map((detail) => detail.label)).not.toContain("확인 흐름");
  });

  it("keeps approved reference documents building-scoped and separate from restricted document types", () => {
    const documents: PublishedDocumentReference[] = [
      { building_id: "bld-cobalt", document_type: "leasing_flyer", reviewed_summary: "담당자가 확인한 임대 안내 참고자료입니다." },
      { building_id: "bld-other", document_type: "floor_plan", reviewed_summary: "다른 건물 참고자료입니다." },
      { building_id: "bld-cobalt", document_type: "legal_document", reviewed_summary: "외부에 표시하면 안 되는 법무 자료입니다." },
      { building_id: "bld-cobalt", document_type: "area_workbook", reviewed_summary: "내부 확인 전용 면적표입니다." },
    ];

    expect(publishedDocumentsForBuilding(documents, "bld-cobalt")).toEqual([documents[0]]);
  });

  it("matches building name, Korean alias, landlord, market, and floor", () => {
    expect(matchesBuildingSearch(cobaltBuilding, "코발트")).toBe(true);
    expect(matchesBuildingSearch(cobaltBuilding, "finance")).toBe(true);
    expect(matchesBuildingSearch(cobaltBuilding, "한빛자산")).toBe(true);
    expect(matchesBuildingSearch(cobaltBuilding, "CBD")).toBe(true);
    expect(matchesBuildingSearch(cobaltBuilding, "5F")).toBe(true);
    expect(matchesBuildingSearch(cobaltBuilding, "퍼시픽")).toBe(false);
  });

  it("shows every matched building in newest-change order without mutating the source", () => {
    const older = { ...cobaltBuilding, building_id: "bld-older", building_name: "Older Tower", latest_changed_at: "2026-07-16T09:00:00+09:00" };
    const source = [older, cobaltBuilding];
    expect(filterAndSortBuildings(source, "").map((building) => building.building_id)).toEqual(["bld-cobalt", "bld-older"]);
    expect(source.map((building) => building.building_id)).toEqual(["bld-older", "bld-cobalt"]);
  });

  it("does not present unsupported or mismatched natural-language requests as successful results", () => {
    const current = { building_name: "Cobalt Finance Center", floor: "5F" };
    expect(interpretHomeRequest("최신 도면과 임대조건 보여줘", current)).toMatchObject({ intent: "building_lookup", matched: true });
    expect(interpretHomeRequest("코발트 5층 최신 면적 보여줘", current)).toMatchObject({ intent: "building_lookup", matched: true });
    expect(interpretHomeRequest("오늘 보낼 5층 안내 자료 준비해줘", current)).toMatchObject({ intent: "package_prepare", matched: true });
    expect(interpretHomeRequest("Cobalt Finance Center 5F 고객에게 보낼 평면도 준비해줘", current)).toMatchObject({ intent: "package_prepare", matched: true });
    expect(interpretHomeRequest("이번 주 임대인 미팅 이슈 정리해줘", current)).toMatchObject({ intent: "weekly_review", matched: true });
    expect(interpretHomeRequest("주간 보고에 넣을 안내 자료 준비해줘", current)).toMatchObject({ intent: "weekly_review", matched: true });
    expect(interpretHomeRequest("퍼시픽타워 최신 도면 보여줘", current)).toMatchObject({ intent: "unsupported", matched: false });
    expect(interpretHomeRequest("코발트 3층 최신 조건 보여줘", current)).toMatchObject({ intent: "unsupported", matched: false });
    expect(interpretHomeRequest("자료 보여줘", current)).toMatchObject({ intent: "unsupported", matched: false });
    expect(interpretHomeRequest("오늘 점심 메뉴 추천해줘", current)).toMatchObject({ intent: "unsupported", matched: false });
  });

  it("derives the home task title from the real workflow state", () => {
    const candidate = { status: "candidate" } as OperationsWorkflow["requests"][number];
    expect(nextWorkAction(candidate, undefined)).toEqual({ label: "Review request", state: "Review required", completed: false });
    expect(nextWorkAction(undefined, { status: "approved" } as OperationsWorkflow["packages"][number])).toEqual({ label: "Record delivery", state: "Approved", completed: false });
    expect(nextWorkAction(undefined, { status: "sent" } as OperationsWorkflow["packages"][number])).toEqual({ label: "Review delivery record", state: "Completed", completed: true });
  });

  it("localizes request deadlines instead of exposing extraction text", () => {
    expect(formatRequestDeadline("today afternoon")).toBe("Today afternoon");
    expect(formatRequestDeadline(null)).toBe("Schedule required");
    expect(formatRequestDeadline("not a date")).toBe("Schedule required");
  });

  it("shows the configured landlord meeting as a compact English schedule", () => {
    expect(formatWeeklyMeeting({ next_meeting_on: "2026-07-23", meeting_time: "15:00" })).toBe("Thu, Jul 23 · 15:00");
    expect(formatWeeklyMeeting(null)).toBe("Schedule required");
  });

  it("shows the configured report checkpoints in workflow order", () => {
    expect(weeklyAutomationSummary(structuredClone(defaultWeeklyAutomation))).toEqual([
      "Previous business day 16:00 · Pre-summary",
      "Report day 08:00 · Morning refresh",
      "Report day 09:30 · Final review",
      "Report day 10:00 · Ready for delivery",
    ]);
  });

  it("counts configured buildings whose weekly report has not been created", () => {
    const groups = {
      revision: 1,
      can_manage_settings: true,
      groups: [{
        group_ref: "hanbit-weekly",
        landlord_name: "한빛자산운용",
        cadence: "weekly" as const,
        meeting_weekday: "thursday" as const,
        meeting_time: "15:00",
        next_meeting_on: "2026-07-23",
        owner_name: "김지우",
        approver_name: "김지우",
        automation: structuredClone(defaultWeeklyAutomation),
        reports: [
          { building_id: "bld-cobalt", building_name: "코발트 센터" },
          { building_id: "bld-pacific-gate", building_name: "퍼시픽타워" },
        ],
      }],
    };
    const reports = [{ building_id: "bld-cobalt", status: "sent" }] as never;
    expect(weeklyAttentionCount(reports, groups)).toBe(1);
  });

  it("uses each successful workflow revision for confirm, draft, approve, and send", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const revisions = [37, 38, 39, 40];
    const fetcher = async (_input: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return Response.json(workflow(revisions[bodies.length - 1]!));
    };
    let current = workflow(36);

    current = await performOperationsWorkflowAction(current, "usr-manager", { action: "confirm", request_id: "request-call-1" }, fetcher);
    current = await performOperationsWorkflowAction(current, "usr-manager", { action: "draft", request_id: "request-call-1" }, fetcher);
    current = await performOperationsWorkflowAction(current, "usr-manager", { action: "approve", package_id: "pkg-request-call-1" }, fetcher);
    current = await performOperationsWorkflowAction(current, "usr-manager", { action: "send", package_id: "pkg-request-call-1", idempotency_key: "web-sandbox-pkg-request-call-1" }, fetcher);

    expect(bodies.map((body) => body.expected_revision)).toEqual([36, 37, 38, 39]);
    expect(current.revision).toBe(40);
  });

  it("surfaces a genuine stale revision conflict without retrying", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetcher = async (_input: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return Response.json({ code: "REVISION_CONFLICT", error: "Expected revision 36, current revision 37.", current_revision: 37 }, { status: 409 });
    };

    await expect(performOperationsWorkflowAction(
      workflow(36),
      "usr-manager",
      { action: "draft", request_id: "request-call-1" },
      fetcher,
    )).rejects.toThrow(/current revision 37/);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.expected_revision).toBe(36);
  });

  it("loads the shared snapshot with the selected actor", async () => {
    const paths: string[] = [];
    const expected = { snapshot_version: 1, revision: 7 } as unknown as OperationsSnapshot;
    const fetcher = async (input: string) => {
      paths.push(input);
      return Response.json(expected);
    };

    await expect(loadOperationsSnapshot("usr-manager", fetcher)).resolves.toEqual(expected);
    expect(paths).toEqual(["/api/operations/snapshot?actor_id=usr-manager"]);
  });

  it("mutates a weekly report with the snapshot revision and refreshes the same actor-scoped snapshot", async () => {
    const calls: Array<{ input: string; body?: Record<string, unknown> }> = [];
    const initial = {
      snapshot_version: 1,
      revision: 11,
      publication_stage: "published",
      scope: { building_ids: ["bld-cobalt"] },
      published: {} as never,
      published_documents: [],
      buildings: [],
      workflow: workflow(11),
      reports: { revision: 11, publication_stage: "published", allowedActions: ["approve"], reports: [], activities: [], audit: [] },
    } as OperationsSnapshot;
    const refreshed = {
      snapshot_version: 1,
      revision: 12,
      publication_stage: "published",
      scope: { building_ids: ["bld-cobalt"] },
      published: {} as never,
      published_documents: [],
      buildings: [],
      workflow: workflow(12),
      reports: { revision: 12, publication_stage: "published", allowedActions: ["approve"], reports: [], activities: [], audit: [] },
    } as OperationsSnapshot;
    const fetcher = async (input: string, init?: RequestInit) => {
      calls.push({ input, ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}) });
      return input === "/api/mobile/reports" ? Response.json({ revision: 12 }) : Response.json(refreshed);
    };

    await expect(performWeeklyReportAction(initial, "usr-manager", "report-cobalt", "approve", undefined, fetcher)).resolves.toEqual(refreshed);
    expect(calls).toEqual([
      { input: "/api/mobile/reports", body: { action: "approve", actor_id: "usr-manager", expected_revision: 11, report_id: "report-cobalt" } },
      { input: "/api/operations/snapshot?actor_id=usr-manager" },
    ]);
  });

  it("uses configured landlord groups and keeps reports building-specific", () => {
    const group: WeeklyOperationalGroup = {
      group_ref: "hanbit-weekly",
      landlord_name: "한빛자산운용",
      cadence: "weekly",
      meeting_weekday: "thursday",
      meeting_time: "15:00",
      next_meeting_on: "2026-07-23",
      owner_name: "김지우",
      approver_name: "김지우",
      automation: structuredClone(defaultWeeklyAutomation),
      reports: [{ building_id: "bld-cobalt", building_name: "코발트 센터" }],
    };
    const reports = [
      { id: "report-cobalt", building_id: "bld-cobalt" },
      { id: "report-other", building_id: "bld-other" },
    ] as never;
    expect(reportsForGroup(group, reports).map((report) => report.id)).toEqual(["report-cobalt"]);
    expect(weeklyChildrenForGroup({
      ...group,
      reports: [
        { building_id: "bld-cobalt", building_name: "코발트 센터" },
        { building_id: "bld-pacific-gate", building_name: "퍼시픽타워" },
      ],
    }, reports)).toEqual([
      expect.objectContaining({ building_id: "bld-cobalt", report: expect.objectContaining({ id: "report-cobalt" }) }),
      expect.objectContaining({ building_id: "bld-pacific-gate", report: null }),
    ]);
  });

  it("drafts exactly one configured building and refreshes both weekly projections", async () => {
    const calls: Array<{ input: string; body?: Record<string, unknown> }> = [];
    const initial = {
      snapshot_version: 1,
      revision: 21,
      publication_stage: "published",
      scope: { building_ids: ["bld-cobalt", "bld-pacific-gate"] },
      published: {} as never,
      published_documents: [],
      buildings: [],
      workflow: workflow(21),
      reports: { revision: 21, publication_stage: "published", allowedActions: ["draft"], reports: [], activities: [], audit: [] },
    } as OperationsSnapshot;
    const refreshed = { ...initial, revision: 22, workflow: workflow(22), reports: { ...initial.reports, revision: 22 } };
    const groups = { revision: 22, groups: [] };
    const fetcher = async (input: string, init?: RequestInit) => {
      calls.push({ input, ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}) });
      if (input === "/api/mobile/reports") return Response.json({ revision: 22 });
      if (input.startsWith("/api/operations/snapshot")) return Response.json(refreshed);
      return Response.json(groups);
    };

    await expect(draftWeeklyBuildingReport(initial, "usr-manager", "bld-pacific-gate", fetcher)).resolves.toEqual({ snapshot: refreshed, groups });
    expect(calls[0]).toEqual({
      input: "/api/mobile/reports",
      body: { action: "draft", actor_id: "usr-manager", expected_revision: 21, building_id: "bld-pacific-gate" },
    });
    expect(calls.slice(1).map((call) => call.input).sort()).toEqual([
      "/api/operations/snapshot?actor_id=usr-manager",
      "/api/weekly-groups?actor_id=usr-manager",
    ]);
  });

  it("loads the actor-scoped weekly groups without using the settings endpoint", async () => {
    const paths: string[] = [];
    const projection = { revision: 1, groups: [] };
    const fetcher = async (input: string) => {
      paths.push(input);
      return Response.json(projection);
    };
    await expect(loadWeeklyGroups("usr-lead", fetcher)).resolves.toEqual(projection);
    expect(paths).toEqual(["/api/weekly-groups?actor_id=usr-lead"]);
  });
});
