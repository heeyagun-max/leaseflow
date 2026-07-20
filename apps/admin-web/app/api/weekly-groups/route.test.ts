import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const directories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("weekly operational groups API", () => {
  it("returns only the actor's authorized building reports without edit-only settings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-weekly-groups-"));
    directories.push(directory);
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("LEASEFLOW_WEEKLY_SETTINGS_PATH", path.join(directory, "weekly.json"));

    const response = await GET(new Request("http://localhost/api/weekly-groups?actor_id=usr-lead"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { can_manage_settings: boolean; groups: Array<Record<string, unknown>> };
    expect(body.can_manage_settings).toBe(false);
    expect(body.groups).toHaveLength(2);
    expect(body.groups[0]).toMatchObject({
      group_ref: "hanbit-weekly",
      landlord_name: "한빛자산운용",
      cadence: "weekly",
      meeting_weekday: "thursday",
      meeting_time: "15:00",
      next_meeting_on: "2026-07-23",
      automation: {
        aggregation_days: 7,
        required_section_keys: expect.arrayContaining(["key_issue", "next_actions"]),
        checkpoints: { pre_summary_time: "16:00", morning_refresh_time: "08:00" },
      },
      reports: [
        { building_id: "bld-cobalt" },
        { building_id: "bld-pacific-gate" },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("recipients");
    expect(JSON.stringify(body)).not.toContain("approver_user_id");
  });
});
