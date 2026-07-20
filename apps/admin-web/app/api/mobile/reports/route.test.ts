import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoExtractionResult } from "@leaseflow/demo-data";
import { DemoFileStore } from "@/lib/demo-store.server";
import { canViewReportAudit } from "@/lib/report-workflow-public.server";
import { GET, OPTIONS, POST } from "./route";

const tempDirectories: string[] = [];

async function publishedFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-report-route-"));
  tempDirectories.push(directory);
  const statePath = path.join(directory, "state.json");
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("LEASEFLOW_DEMO_STATE_PATH", statePath);
  const store = new DemoFileStore(statePath);
  const extracted = await store.extract(
    { actor_id: "usr-junior", expected_revision: 0, occurred_at: "2026-07-18T09:00:00.000Z" },
    demoExtractionResult,
  );
  const confirmed = await store.confirm({
    actor_id: "usr-junior",
    expected_revision: extracted.revision,
    occurred_at: "2026-07-18T09:01:00.000Z",
  });
  return store.publish({
    actor_id: "usr-senior",
    expected_revision: confirmed.revision,
    occurred_at: "2026-07-18T09:02:00.000Z",
  });
}

function action(body: unknown) {
  return POST(new Request("http://localhost/api/mobile/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key);
      collectKeys(item, keys);
    }
  }
  return keys;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.sequential("weekly report mobile route", () => {
  it("scopes report audit access to manager-level roles", () => {
    expect(canViewReportAudit("data_steward")).toBe(false);
    expect(canViewReportAudit("senior_reviewer")).toBe(false);
    expect(canViewReportAudit("lm_manager")).toBe(true);
    expect(canViewReportAudit("admin")).toBe(true);
  });

  it("fails closed outside explicit demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const response = await GET(new Request("http://localhost/api/mobile/reports?actor_id=usr-manager"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "DEMO_DISABLED" });
  });

  it("provides CORS preflight without exposing state", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe("GET,POST,OPTIONS");
  });

  it("rejects unknown commands, unknown actions, and extra keys", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const invalidBodies = [
      { action: "investigate", actor_id: "usr-manager", expected_revision: 0, report_id: "report-1", command: "아무거나 업데이트 해" },
      { action: "erase", actor_id: "usr-manager", expected_revision: 0 },
      { action: "draft", actor_id: "usr-manager", expected_revision: 0, building_id: "bld-cobalt", extra: true },
    ];
    for (const body of invalidBodies) {
      const response = await action(body);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: "INVALID_REQUEST" });
    }
  });

  it("dispatches the governed report lifecycle while exposing only the curated report DTO", async () => {
    const published = await publishedFixture();
    const draftedResponse = await action({
      action: "draft", actor_id: "usr-manager", expected_revision: published.revision, building_id: "bld-cobalt",
    });
    expect(draftedResponse.status).toBe(200);
    expect(draftedResponse.headers.get("cache-control")).toBe("no-store");
    const drafted = await draftedResponse.json() as { revision: number; reports: Array<{ id: string }> };
    const reportId = drafted.reports[0]!.id;

    const investigatedResponse = await action({
      action: "investigate",
      actor_id: "usr-manager",
      expected_revision: drafted.revision,
      report_id: reportId,
      command: "이메일 확인해서 이번주 변동사항 업데이트 해",
    });
    expect(investigatedResponse.status).toBe(200);
    const investigated = await investigatedResponse.json() as { revision: number };

    const decidedResponse = await action({
      action: "decide_patch",
      actor_id: "usr-manager",
      expected_revision: investigated.revision,
      report_id: reportId,
      decision: "reject",
    });
    expect(decidedResponse.status).toBe(200);
    const decided = await decidedResponse.json() as { revision: number };

    const approvedResponse = await action({
      action: "approve", actor_id: "usr-manager", expected_revision: decided.revision, report_id: reportId,
    });
    expect(approvedResponse.status).toBe(200);
    const approved = await approvedResponse.json() as { revision: number };

    const sentResponse = await action({
      action: "send", actor_id: "usr-manager", expected_revision: approved.revision,
      report_id: reportId, idempotency_key: "weekly-route-send-1",
    });
    expect(sentResponse.status).toBe(200);
    const sent = await sentResponse.json() as unknown;
    const forbiddenKeys = ["actor_id", "approved_by", "idempotency_key", "raw_text", "protected_snapshot", "metadata"];
    expect([...collectKeys(sent)].filter((key) => forbiddenKeys.includes(key))).toEqual([]);
    expect(JSON.stringify(sent)).not.toContain("mail-002");
    expect(sent).toMatchObject({
      allowedActions: ["draft", "investigate", "decide_patch", "approve", "send"],
      audit: expect.arrayContaining([expect.objectContaining({
        actor_label: "James Kim",
        actor_role_label: "임대 관리 책임자",
      })]),
    });

    const getResponse = await GET(new Request("http://localhost/api/mobile/reports?actor_id=usr-manager"));
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("cache-control")).toBe("no-store");
    const current = await getResponse.json() as unknown;
    expect([...collectKeys(current)].filter((key) => forbiddenKeys.includes(key))).toEqual([]);
  });

  it("returns actor-scoped actions and hides audit history from non-manager roles", async () => {
    await publishedFixture();
    for (const actorId of ["usr-junior", "usr-senior"]) {
      const response = await GET(new Request(`http://localhost/api/mobile/reports?actor_id=${actorId}`));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ allowedActions: [], audit: [] });
    }
  });

  it("keeps the API authoritative when a selected non-LM role attempts report approval", async () => {
    const published = await publishedFixture();
    const draftedResponse = await action({
      action: "draft", actor_id: "usr-manager", expected_revision: published.revision, building_id: "bld-cobalt",
    });
    const drafted = await draftedResponse.json() as { revision: number; reports: Array<{ id: string }> };

    const response = await action({
      action: "approve",
      actor_id: "usr-senior",
      expected_revision: drafted.revision,
      report_id: drafted.reports[0]!.id,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "FORBIDDEN", error: "현재 역할로 이 작업을 수행할 수 없습니다." });
  });

  it("requires a selected building and enforces actor scope for report list, detail, and actions", async () => {
    const published = await publishedFixture();
    const missingBuilding = await action({
      action: "draft", actor_id: "usr-manager", expected_revision: published.revision,
    });
    expect(missingBuilding.status).toBe(400);

    const cobaltResponse = await action({
      action: "draft", actor_id: "usr-manager", expected_revision: published.revision, building_id: "bld-cobalt",
    });
    const cobalt = await cobaltResponse.json() as { revision: number };
    const pacificResponse = await action({
      action: "draft", actor_id: "usr-manager", expected_revision: cobalt.revision, building_id: "bld-pacific-gate",
    });
    expect(pacificResponse.status).toBe(200);
    const pacific = await pacificResponse.json() as { revision: number; reports: Array<{ id: string; building_id: string }> };
    const pacificReport = pacific.reports.find((report) => report.building_id === "bld-pacific-gate")!;

    const juniorList = await GET(new Request("http://localhost/api/mobile/reports?actor_id=usr-junior"));
    expect(juniorList.status).toBe(200);
    await expect(juniorList.json()).resolves.toMatchObject({ reports: [{ building_id: "bld-cobalt" }] });

    const unauthorizedDetail = await GET(new Request(
      `http://localhost/api/mobile/reports?actor_id=usr-junior&report_id=${pacificReport.id}`,
    ));
    expect(unauthorizedDetail.status).toBe(403);
    await expect(unauthorizedDetail.json()).resolves.toMatchObject({ code: "FORBIDDEN" });

    const unauthorizedDraft = await action({
      action: "draft",
      actor_id: "usr-lead",
      expected_revision: pacific.revision,
      building_id: "bld-pacific-gate",
    });
    expect(unauthorizedDraft.status).toBe(403);
    await expect(unauthorizedDraft.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
  });

  it("persists stale state and returns 409 when an existing report loses its configured authority", async () => {
    const published = await publishedFixture();
    const draftedResponse = await action({
      action: "draft", actor_id: "usr-manager", expected_revision: published.revision, building_id: "bld-cobalt",
    });
    const drafted = await draftedResponse.json() as { revision: number; reports: Array<{ id: string }> };
    const statePath = process.env.LEASEFLOW_DEMO_STATE_PATH!;
    const settingsPath = path.join(path.dirname(statePath), "weekly-settings.v1.json");
    const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
      groups: Array<{ building_ids: string[] }>;
    };
    settings.groups[0]!.building_ids = settings.groups[0]!.building_ids.filter((id) => id !== "bld-cobalt");
    await writeFile(settingsPath, JSON.stringify(settings), "utf8");

    const response = await action({
      action: "approve",
      actor_id: "usr-manager",
      expected_revision: drafted.revision,
      report_id: drafted.reports[0]!.id,
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "WORKFLOW_STALE",
      error: "Weekly report inputs changed. Reload the current state before continuing.",
      current_revision: drafted.revision + 1,
    });

    const current = await GET(new Request("http://localhost/api/mobile/reports?actor_id=usr-manager"));
    expect(current.status).toBe(200);
    await expect(current.json()).resolves.toMatchObject({
      revision: drafted.revision + 1,
      reports: [{ id: drafted.reports[0]!.id, status: "stale" }],
    });

    const repeated = await action({
      action: "approve",
      actor_id: "usr-manager",
      expected_revision: drafted.revision + 1,
      report_id: drafted.reports[0]!.id,
    });
    expect(repeated.status).toBe(409);
    await expect(repeated.json()).resolves.toMatchObject({
      code: "WORKFLOW_STALE",
      current_revision: drafted.revision + 1,
    });
  });
});
