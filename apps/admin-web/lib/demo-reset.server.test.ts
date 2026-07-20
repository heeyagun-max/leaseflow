import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoExtractionResult } from "@leaseflow/demo-data";
import { BuildingUpdateIntakeStore } from "./building-updates.server";
import { DemoResetCoordinator } from "./demo-reset.server";
import { DemoFileStore } from "./demo-store.server";
import { WeeklySettingsStore } from "./weekly-settings.server";

const directories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-reset-coordinator-"));
  directories.push(directory);
  const workflow = new DemoFileStore(path.join(directory, "state.json"));
  const intake = new BuildingUpdateIntakeStore(path.join(directory, "building-updates.json"));
  const weekly = new WeeklySettingsStore({ statePath: path.join(directory, "weekly-settings.json") });
  const workflowState = await workflow.extract(
    { actor_id: "usr-junior", expected_revision: 0, occurred_at: "2026-07-19T01:00:00.000Z" },
    demoExtractionResult,
  );
  await intake.save({
    update_ref: "cobalt-2026-07-18",
    selected_file: "july-building-update",
    source_organization: "Synthetic Asset Management",
    effective_date: "2026-07-18",
    building_name: "Cobalt Finance Center",
    registered_at: "2026-07-19T01:00:00.000Z",
  });
  return { workflow, intake, weekly, expectedRevision: workflowState.revision };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.sequential("demo reset coordinator", () => {
  it("keeps every snapshot when the main workflow reset fails", async () => {
    const { workflow, intake, weekly, expectedRevision } = await fixture();
    const before = {
      workflow: await workflow.getState(),
      intake: await intake.get(),
      weekly: await weekly.snapshotForDemoReset("usr-junior"),
    };
    vi.spyOn(workflow, "reset").mockRejectedValueOnce(new Error("workflow reset failed"));

    await expect(new DemoResetCoordinator(workflow, intake, weekly).reset({
      actor_id: "usr-junior",
      expected_revision: expectedRevision,
    })).rejects.toThrow("workflow reset failed");

    await expect(workflow.getState()).resolves.toEqual(before.workflow);
    await expect(intake.get()).resolves.toEqual(before.intake);
    await expect(weekly.snapshotForDemoReset("usr-junior")).resolves.toEqual(before.weekly);
  });

  it("restores every store when clearing the building-update intake fails", async () => {
    const { workflow, intake, weekly, expectedRevision } = await fixture();
    const before = {
      workflow: await workflow.getState(),
      intake: await intake.get(),
      weekly: await weekly.snapshotForDemoReset("usr-junior"),
    };
    vi.spyOn(intake, "clear").mockRejectedValueOnce(new Error("intake clear failed"));

    await expect(new DemoResetCoordinator(workflow, intake, weekly).reset({
      actor_id: "usr-junior",
      expected_revision: expectedRevision,
    })).rejects.toThrow("intake clear failed");

    await expect(workflow.getState()).resolves.toEqual(before.workflow);
    await expect(intake.get()).resolves.toEqual(before.intake);
    await expect(weekly.snapshotForDemoReset("usr-junior")).resolves.toEqual(before.weekly);
  });

  it("restores workflow, intake, and settings when weekly-settings reset fails", async () => {
    const { workflow, intake, weekly, expectedRevision } = await fixture();
    const before = {
      workflow: await workflow.getState(),
      intake: await intake.get(),
      weekly: await weekly.snapshotForDemoReset("usr-junior"),
    };
    vi.spyOn(weekly, "resetForDemo").mockRejectedValueOnce(new Error("weekly reset failed"));

    await expect(new DemoResetCoordinator(workflow, intake, weekly).reset({
      actor_id: "usr-junior",
      expected_revision: expectedRevision,
    })).rejects.toThrow("weekly reset failed");

    await expect(workflow.getState()).resolves.toEqual(before.workflow);
    await expect(intake.get()).resolves.toEqual(before.intake);
    await expect(weekly.snapshotForDemoReset("usr-junior")).resolves.toEqual(before.weekly);
  });
});
