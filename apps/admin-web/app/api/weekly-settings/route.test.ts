import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultWeeklyAutomation } from "@/lib/weekly-settings-schema";
import { GET, POST, PUT } from "./route";

const directories: string[] = [];

function request(method: "POST" | "PUT", body: unknown) {
  return new Request("http://localhost/api/weekly-settings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const group = {
  landlord_name: "새봄자산운용",
  building_ids: ["bld-cobalt"],
  cadence: "weekly",
  meeting_weekday: "friday",
  meeting_time: "11:00",
  next_meeting_on: "2026-07-24",
  owner_user_id: "usr-manager",
  approver_user_id: "usr-manager",
  recipients: {
    to: [{ email: "saebom@example.test", role: "to_landlord_practical" }],
    cc: [
      { email: "saebom.team@example.test", role: "cc_landlord_team" },
      { email: "saebom.exec@example.test", role: "cc_landlord_exec" },
      { email: "lease.team@example.test", role: "cc_lm_team" },
      { email: "lease.exec@example.test", role: "cc_lm_exec" },
    ],
  },
  automation: structuredClone(defaultWeeklyAutomation),
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.sequential("weekly settings API", () => {
  async function enableDemo() {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-weekly-route-"));
    directories.push(directory);
    vi.stubEnv("DEMO_MODE", "true");
    const statePath = path.join(directory, "state.json");
    await writeFile(statePath, JSON.stringify({ revision: 0, groups: [], audit: [] }), "utf8");
    vi.stubEnv("LEASEFLOW_WEEKLY_SETTINGS_PATH", statePath);
  }

  it("blocks the route outside demo mode and blocks non-manager roles", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const disabled = await GET(new Request("http://localhost/api/weekly-settings?actor_id=usr-manager"));
    expect(disabled.status).toBe(404);

    await enableDemo();
    const forbidden = await GET(new Request("http://localhost/api/weekly-settings?actor_id=usr-junior"));
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual({ error: "임대 관리 책임자만 주간업무 설정을 관리할 수 있습니다." });
  });

  it("creates, reads, and edits a saved report group", async () => {
    await enableDemo();
    const initialResponse = await GET(new Request("http://localhost/api/weekly-settings?actor_id=usr-manager"));
    expect(initialResponse.status).toBe(200);
    const initial = await initialResponse.json() as { revision: number };

    const createResponse = await POST(request("POST", { actor_id: "usr-manager", expected_revision: initial.revision, group }));
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { revision: number; groups: Array<{ ref: string; report_scope: string }> };
    expect(created.groups[0]?.report_scope).toBe("building_specific");
    const ref = created.groups[0]!.ref;

    const updateResponse = await PUT(request("PUT", {
      actor_id: "usr-manager",
      expected_revision: created.revision,
      group_ref: ref,
      group: {
        ...group,
        next_meeting_on: "2026-07-31",
        automation: { ...group.automation, required_section_keys: ["key_issue", "next_actions"] },
        recipients: { ...group.recipients, to: [{ email: "changed@example.test", role: "to_landlord_practical" }] },
      },
    }));
    expect(updateResponse.status).toBe(200);

    const getResponse = await GET(new Request(`http://localhost/api/weekly-settings?actor_id=usr-manager&group_ref=${encodeURIComponent(ref)}`));
    expect(getResponse.headers.get("cache-control")).toBe("no-store");
    await expect(getResponse.json()).resolves.toMatchObject({ groups: [{
      next_meeting_on: "2026-07-31",
      recipients: { to: [{ email: "changed@example.test", role: "to_landlord_practical" }] },
      automation: { required_section_keys: ["key_issue", "next_actions"] },
      report_scope: "building_specific",
    }] });
  });

  it("rejects an actor supplied only in the query when the mutation body is unauthorized", async () => {
    await enableDemo();
    const response = await POST(request("POST", { actor_id: "usr-junior", expected_revision: 1, group }));
    expect(response.status).toBe(403);
  });

  it("does not expose storage details when saved settings cannot be read", async () => {
    await enableDemo();
    const statePath = process.env.LEASEFLOW_WEEKLY_SETTINGS_PATH!;
    await writeFile(statePath, "not-json", "utf8");

    const response = await GET(new Request("http://localhost/api/weekly-settings?actor_id=usr-manager"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "설정을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  });
});
