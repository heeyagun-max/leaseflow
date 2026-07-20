import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WeeklySettingsAccessError,
  WeeklySettingsRevisionError,
  WeeklySettingsStore,
} from "./weekly-settings.server";
import type { WeeklySettingsCatalog } from "./weekly-settings-config.server";
import { defaultWeeklyAutomation, type WeeklySettingsInput } from "./weekly-settings-schema";

const directories: string[] = [];
const catalog: WeeklySettingsCatalog = {
  buildings: [
    { id: "building-a", name: "가람타워" },
    { id: "building-b", name: "누리센터" },
  ],
  users: [
    { id: "manager", name: "김지우", role: "lm_manager", building_ids: ["building-a", "building-b"] },
    { id: "lead", name: "한서윤", role: "team_lead", building_ids: ["building-a", "building-b"] },
    { id: "steward", name: "박하늘", role: "data_steward", building_ids: [] },
  ],
};

const input: WeeklySettingsInput = {
  landlord_name: "가람자산운용",
  building_ids: ["building-a", "building-b"],
  cadence: "weekly",
  meeting_weekday: "thursday",
  meeting_time: "15:00",
  next_meeting_on: "2026-07-23",
  owner_user_id: "manager",
  approver_user_id: "manager",
  recipients: {
    to: [{ email: "landlord@example.test", role: "to_landlord_practical" }],
    cc: [
      { email: "landlord.team@example.test", role: "cc_landlord_team" },
      { email: "landlord.exec@example.test", role: "cc_landlord_exec" },
      { email: "leasing.team@example.test", role: "cc_lm_team" },
      { email: "leasing.exec@example.test", role: "cc_lm_exec" },
    ],
  },
  automation: structuredClone(defaultWeeklyAutomation),
};

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-weekly-settings-"));
  directories.push(directory);
  const statePath = path.join(directory, "runtime.json");
  const seedPath = path.join(directory, "seed.json");
  await writeFile(seedPath, JSON.stringify({ revision: 0, groups: [], audit: [] }), "utf8");
  const store = new WeeklySettingsStore({
    statePath,
    seedPath,
    now: () => new Date("2026-07-19T06:00:00.000Z"),
    catalogLoader: async () => catalog,
  });
  return { statePath, store };
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.sequential("weekly settings store", () => {
  it("keeps default state beside the configured demo workflow state", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-weekly-configured-"));
    directories.push(directory);
    vi.stubEnv("LEASEFLOW_DEMO_STATE_PATH", path.join(directory, "state.v1.json"));

    await new WeeklySettingsStore().resetToSeed();

    await expect(readFile(path.join(directory, "weekly-settings.v1.json"), "utf8")).resolves.toContain('"revision": 2');
  });

  it("restores the configured seed", async () => {
    const { store } = await fixture();
    await store.create("manager", 0, input);

    const reset = await store.resetToSeed("manager");

    expect(reset).toMatchObject({
      revision: 2,
      groups: [],
      audit: [{ event_type: "weekly_settings.created" }, { event_type: "weekly_settings.reset" }],
    });
    await expect(store.get("manager")).resolves.toMatchObject({ revision: 2, groups: [] });
  });

  it("preserves saved groups when migrating earlier email-list settings", async () => {
    const { statePath, store } = await fixture();
    const { automation: _automation, ...legacyInput } = input;
    await writeFile(statePath, JSON.stringify({
      revision: 7,
      groups: [{
        ...legacyInput,
        ref: "legacy-landlord",
        landlord_name: "기존 임대인",
        recipients: {
          to: ["landlord@example.test"],
          cc: [
            "landlord.team@example.test",
            "landlord.exec@example.test",
            "leasing.team@example.test",
            "leasing.exec@example.test",
          ],
        },
        report_scope: "building_specific",
        updated_at: "2026-07-18T09:00:00.000Z",
      }],
    }), "utf8");

    const migrated = await store.get("manager");

    expect(migrated).toMatchObject({
      revision: 7,
      groups: [{
        landlord_name: "기존 임대인",
        automation: defaultWeeklyAutomation,
        recipients: {
          to: [{ email: "landlord@example.test", role: "to_landlord_practical" }],
          cc: [
            { email: "landlord.team@example.test", role: "cc_landlord_team" },
            { email: "landlord.exec@example.test", role: "cc_landlord_exec" },
            { email: "leasing.team@example.test", role: "cc_lm_team" },
            { email: "leasing.exec@example.test", role: "cc_lm_exec" },
          ],
        },
      }],
    });
  });

  it("fails closed for roles that cannot manage weekly settings", async () => {
    const { statePath, store } = await fixture();
    await expect(store.get("steward")).rejects.toBeInstanceOf(WeeklySettingsAccessError);
    await expect(store.create("steward", 0, input)).rejects.toBeInstanceOf(WeeklySettingsAccessError);
    await expect(readFile(statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("persists a landlord preparation group while forcing building-specific reports", async () => {
    const { statePath, store } = await fixture();
    const created = await store.create("manager", 0, input);
    expect(created.revision).toBe(1);
    expect(created.groups[0]).toMatchObject({
      landlord_name: "가람자산운용",
      building_names: ["가람타워", "누리센터"],
      owner_name: "김지우",
      approver_name: "김지우",
      recipients: input.recipients,
      automation: input.automation,
      report_scope: "building_specific",
    });
    const persisted = JSON.parse(await readFile(statePath, "utf8")) as { groups: Array<Record<string, unknown>> };
    expect(persisted.groups[0]?.report_scope).toBe("building_specific");
    expect(persisted.groups[0]?.recipients).toEqual(input.recipients);
  });

  it("updates saved recipients and rejects stale edits", async () => {
    const { store } = await fixture();
    const created = await store.create("manager", 0, input);
    const ref = created.groups[0]!.ref;
    const changed: WeeklySettingsInput = {
      ...input,
      recipients: {
        ...input.recipients,
        to: [{ email: "new.landlord@example.test", role: "to_landlord_practical" }],
      },
    };
    const updated = await store.update("manager", created.revision, ref, changed);
    expect(updated.groups[0]?.recipients).toEqual(changed.recipients);
    await expect(store.update("manager", created.revision, ref, input)).rejects.toBeInstanceOf(WeeklySettingsRevisionError);
  });

  it("requires configured buildings, owners, approvers, and non-overlapping recipients", async () => {
    const { store } = await fixture();
    await expect(store.create("manager", 0, { ...input, building_ids: ["missing"] })).rejects.toThrow("담당 권한");
    await expect(store.create("manager", 0, { ...input, approver_user_id: "steward" })).rejects.toThrow("임대 관리 책임자");
    await expect(store.create("manager", 0, {
      ...input,
      recipients: {
        ...input.recipients,
        cc: input.recipients.cc.map((recipient, index) => ({ ...recipient, email: index === 0 ? input.recipients.to[0]!.email : recipient.email })),
      },
    })).rejects.toThrow("중복");
  });

  it("serializes concurrent edits so only one matching revision can win", async () => {
    const { store } = await fixture();
    const [first, second] = await Promise.allSettled([
      store.create("manager", 0, input),
      store.create("manager", 0, { ...input, landlord_name: "누리자산운용" }),
    ]);
    expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = first.status === "rejected" ? first.reason : second.status === "rejected" ? second.reason : null;
    expect(rejected).toBeInstanceOf(WeeklySettingsRevisionError);
  });

  it("keeps every building in exactly one deterministic report group", async () => {
    const { store } = await fixture();
    const created = await store.create("manager", 0, input);
    await expect(store.create("manager", created.revision, {
      ...input,
      landlord_name: "겹치는자산운용",
      building_ids: ["building-a"],
    })).rejects.toThrow("하나의 임대인 보고그룹");
    const authorities = await store.getAuthorities();
    expect(authorities.map(({ building_id }) => building_id).sort()).toEqual(["building-a", "building-b"]);
    expect(authorities.every(({ configuration_id }) => configuration_id.endsWith("-v1"))).toBe(true);
  });
});
