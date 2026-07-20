import { describe, expect, it } from "vitest";
import { createInitialWeeklyReportState, createWeeklyReportDraft } from "@leaseflow/domain";
import {
  createDemoWeeklyReportDraftInput,
  createInitialDemoState,
  currentDemoWeeklyReportMaterialIds,
} from "@leaseflow/demo-data";
import { loadOperationsSnapshotPublic } from "./operations-snapshot-public.server";

const state = createInitialDemoState();
const store = { getState: async () => structuredClone(state) };
const access = { configuration_id: "access-1", users: [{ user_id: "usr-manager", building_ids: ["bld-cobalt"] }] };

describe("actor-scoped operations snapshot projection", () => {
  it("uses one state read and returns only curated public surfaces", async () => {
    const snapshot = await loadOperationsSnapshotPublic("usr-manager", store, async () => ({ access }));
    expect(snapshot.revision).toBe(snapshot.published.revision);
    expect(snapshot.revision).toBe(snapshot.workflow.revision);
    expect(snapshot.revision).toBe(snapshot.reports.revision);
    expect(snapshot.scope.building_ids).toEqual(["bld-cobalt"]);
    expect(snapshot.buildings).toMatchObject([{ building_id: "bld-cobalt", marketed_area_py: 300 }]);
    expect(snapshot.buildings[0]).not.toHaveProperty("external_shareable");
    const serialized = JSON.stringify(snapshot);
    for (const forbidden of ["raw_text", "source_id", "actor_id", "actor_role", "metadata", "protected_snapshot", "idempotency_key"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`);
    }
  });

  it("returns every authorized published building summary and no building outside scope", async () => {
    const snapshot = await loadOperationsSnapshotPublic("usr-manager", store, async () => ({
      access: { configuration_id: "access-portfolio", users: [{ user_id: "usr-manager", building_ids: ["bld-cobalt", "bld-pacific-gate", "bld-teheran-link"] }] },
    }));
    expect(snapshot.buildings.map((building) => building.building_id)).toEqual([
      "bld-cobalt",
      "bld-pacific-gate",
      "bld-teheran-link",
    ]);
    expect(snapshot.buildings.every((building) => snapshot.scope.building_ids.includes(building.building_id))).toBe(true);
  });

  it("rejects known actors without configured building access", async () => {
    await expect(loadOperationsSnapshotPublic("usr-senior", store, async () => ({ access })))
      .rejects.toThrow("not authorized");
  });

  it("filters reports to actor-authorized buildings without treating the Cobalt publication scope as report scope", async () => {
    const multiBuilding = createInitialDemoState();
    const cobalt = createDemoWeeklyReportDraftInput("bld-cobalt");
    const pacific = createDemoWeeklyReportDraftInput("bld-pacific-gate");
    let reports = createWeeklyReportDraft(
      createInitialWeeklyReportState(), cobalt, currentDemoWeeklyReportMaterialIds(cobalt),
      { id: "usr-manager", role: "lm_manager" }, "2026-07-18T12:01:00.000Z",
    );
    reports = createWeeklyReportDraft(
      reports, pacific, currentDemoWeeklyReportMaterialIds(pacific),
      { id: "usr-manager", role: "lm_manager" }, "2026-07-18T12:02:00.000Z",
    );
    multiBuilding.operations.reports = reports;
    const snapshot = await loadOperationsSnapshotPublic(
      "usr-manager",
      { getState: async () => structuredClone(multiBuilding) },
      async () => ({ access }),
    );

    expect(snapshot.reports.reports).toMatchObject([{ building_id: "bld-cobalt" }]);
    expect(JSON.stringify(snapshot.reports)).not.toContain("bld-pacific-gate");
  });

  it("publishes actor-scoped Pacific references at snapshot top level without private review fields", async () => {
    const withDocuments = createInitialDemoState();
    const base = withDocuments.asset_registry.assets.find((asset) => asset.id === "asset-cobalt-flyer")!;
    withDocuments.asset_registry.assets.push({
      ...base,
      id: "doc-pacific-published-current",
      building_id: "bld-pacific-gate",
      building_alias_candidate: "Pacific Gate Tower",
      document_type: "leasing_flyer",
      status: "published",
      active: true,
      authorized: true,
      externally_shareable: true,
      reviewed_summary: "Synthetic leasing reference summary.",
      source_origin: "synthetic_seed",
      candidate_text: "private candidate text",
      content_fingerprint: "sha256:private-fingerprint",
      stored_filename: "private-runtime-name.pdf",
      reviewer: "usr-junior",
    } as unknown as typeof base);

    const snapshot = await loadOperationsSnapshotPublic(
      "usr-manager",
      { getState: async () => structuredClone(withDocuments) },
      async () => ({
        access: {
          configuration_id: "access-documents",
          users: [{ user_id: "usr-manager", building_ids: ["bld-cobalt", "bld-pacific-gate"] }],
        },
      }),
    );
    const documents = (snapshot as unknown as { published_documents?: unknown[] }).published_documents;

    expect(documents).toEqual([
      expect.objectContaining({
        building_id: "bld-pacific-gate",
        document_type: "leasing_flyer",
        reviewed_summary: "Synthetic leasing reference summary.",
      }),
    ]);
    expect((documents as Array<{ building_id: string }>).every((document) => (
      snapshot.scope.building_ids.includes(document.building_id)
    ))).toBe(true);
    const serialized = JSON.stringify(documents);
    for (const forbidden of ["candidate_text", "content_fingerprint", "stored_filename", "reviewer"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`);
    }
  });
});
