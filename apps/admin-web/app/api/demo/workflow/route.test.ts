import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoFileStore } from "@/lib/demo-store.server";
import { canViewDemoSettings, loadDemoWorkflowProjection, seoulDateStamp, selectCurrentExternalOperations } from "@/lib/demo-workflow-public.server";
import { GET } from "./route";

const tempDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("demo workflow projection", () => {
  it("rejects a missing or unknown actor without exposing actor details", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    for (const url of ["http://localhost/api/demo/workflow", "http://localhost/api/demo/workflow?actor_id=intruder"]) {
      const response = await GET(new Request(url));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "요청한 역할 정보를 확인할 수 없습니다." });
    }
  });

  it("projects recipient drift from the current runtime configuration", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-workflow-route-"));
    tempDirectories.push(directory);
    const store = new DemoFileStore(path.join(directory, "state.json"));

    const projection = await loadDemoWorkflowProjection(store, async () => ({
      reportRecipients: {
        configuration_id: "recipient-group-runtime-v2",
        building_id: "bld-cobalt",
        to: [{ email: "runtime.manager@example.test", role: "to_landlord_practical" }],
        cc: [
          { email: "runtime.team@example.test", role: "cc_landlord_team" },
          { email: "runtime.exec@example.test", role: "cc_landlord_exec" },
          { email: "runtime.lm@example.test", role: "cc_lm_team" },
          { email: "runtime.lm.exec@example.test", role: "cc_lm_exec" },
        ],
      },
    }));

    expect(projection.reportConfiguration).toMatchObject({ recipients: { to: [{ email: "runtime.manager@example.test" }] } });
    expect(projection.reportConfiguration).not.toHaveProperty("configurationId");
  });

  it("scopes settings and audit visibility to manager-level roles", async () => {
    expect(canViewDemoSettings("data_steward")).toBe(false);
    expect(canViewDemoSettings("senior_reviewer")).toBe(false);
    expect(canViewDemoSettings("lm_manager")).toBe(true);
    expect(canViewDemoSettings("admin")).toBe(true);

    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-workflow-access-"));
    tempDirectories.push(directory);
    const store = new DemoFileStore(path.join(directory, "state.json"));
    const loadConfig = async () => ({ reportRecipients: {
      configuration_id: "recipient-group-runtime-v2", building_id: "bld-cobalt",
      to: [{ email: "manager@example.test", role: "to_landlord_practical" }],
      cc: [{ email: "team@example.test", role: "cc_landlord_team" }],
    } });
    const junior = await loadDemoWorkflowProjection(store, loadConfig, "usr-junior");
    const senior = await loadDemoWorkflowProjection(store, loadConfig, "usr-senior");
    const manager = await loadDemoWorkflowProjection(store, loadConfig, "usr-manager");
    expect(junior).toMatchObject({ canViewSettings: false, reportConfiguration: null, state: { audit: [] } });
    expect(senior).toMatchObject({ canViewSettings: false, reportConfiguration: null, state: { audit: [] } });
    expect(manager.canViewSettings).toBe(true);
    expect(manager.reportConfiguration).not.toBeNull();
  });

  it("uses the Seoul calendar date for canonical current selection", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-workflow-current-"));
    tempDirectories.push(directory);
    const state = await new DemoFileStore(path.join(directory, "state.json")).getState();
    state.records = [{ ...state.records[0]!, valid_from: "2026-07-19", valid_to: null }];
    expect(seoulDateStamp(new Date("2026-07-18T14:59:59.000Z"))).toBe("2026-07-18");
    expect(seoulDateStamp(new Date("2026-07-18T15:00:00.000Z"))).toBe("2026-07-19");
    expect(selectCurrentExternalOperations(state, new Date("2026-07-18T14:59:59.000Z")).records).toHaveLength(0);
    expect(selectCurrentExternalOperations(state, new Date("2026-07-18T15:00:00.000Z")).records).toHaveLength(1);
  });

  it("keeps the actual review batch reference stable across demo reset", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-workflow-batch-ref-"));
    tempDirectories.push(directory);
    const store = new DemoFileStore(path.join(directory, "state.json"));
    const loadConfig = async () => ({ reportRecipients: {
      configuration_id: "recipient-group-runtime-v2", building_id: "bld-cobalt",
      to: [{ email: "manager@example.test", role: "to_landlord_practical" }],
      cc: [{ email: "team@example.test", role: "cc_landlord_team" }],
    } });
    const before = await loadDemoWorkflowProjection(store, loadConfig, "usr-manager");
    await store.reset({ actor_id: "usr-manager", expected_revision: before.state.revision });
    const after = await loadDemoWorkflowProjection(store, loadConfig, "usr-manager");
    expect(before.reviewBatchRef).toBe(before.state.source_id);
    expect(after.reviewBatchRef).toBe(before.reviewBatchRef);
  });
});
