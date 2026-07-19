import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ReportPatchGenerationAdapterInput } from "@leaseflow/ai";
import type { CreateWeeklyReportDraftInput } from "@leaseflow/domain";
import {
  createDemoWeeklyReportDraftInput,
  createInitialDemoState,
  demoExtractionResult,
} from "@leaseflow/demo-data";
import {
  DemoFileStore,
  loadDemoRuntimeConfiguration,
  type DemoRuntimeConfiguration,
} from "./demo-store.server";
import {
  loadCanonicalWeeklyReportDraft,
  loadExternalReportableMockOutlook,
} from "./mock-outlook.server";
import {
  createReportWorkflowService,
  toPublicReportWorkflow,
} from "./report-workflow-public.server";

const tempDirectories: string[] = [];

async function fixture(options: {
  configLoader?: () => Promise<DemoRuntimeConfiguration>;
  reportDraftLoader?: () => Promise<CreateWeeklyReportDraftInput>;
} = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-stage4-report-"));
  tempDirectories.push(directory);
  const statePath = path.join(directory, "state.json");
  const store = new DemoFileStore(
    statePath,
    options.configLoader ?? loadDemoRuntimeConfiguration,
    options.reportDraftLoader ?? loadCanonicalWeeklyReportDraft,
  );
  return { statePath, store, service: createReportWorkflowService({ store }) };
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
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

async function publishStage2(store: DemoFileStore) {
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

describe("weekly report persistence and server workflow", () => {
  it("migrates schema v2 to v3 and persists empty report state across restart", async () => {
    const { statePath, store } = await fixture();
    const current = createInitialDemoState();
    const { reports: _reports, ...legacyOperations } = current.operations;
    const legacy = { ...current, schema_version: 2, operations: legacyOperations };
    await writeFile(statePath, JSON.stringify(legacy), "utf8");

    const migrated = await store.getState();
    expect(migrated.schema_version).toBe(3);
    expect(migrated.operations.reports).toEqual({ reports: [], activities: [], audit: [] });
    const persisted = JSON.parse(await readFile(statePath, "utf8")) as { schema_version?: unknown };
    expect(persisted.schema_version).toBe(3);
    expect(await new DemoFileStore(statePath).getState()).toEqual(migrated);
  });

  it("filters mock Outlook before the report or model boundary", async () => {
    const activity = await loadExternalReportableMockOutlook({
      buildingId: "bld-cobalt",
      period: { from: "2026-07-13", to: "2026-07-18" },
    });
    expect(activity.map((item) => item.id)).toEqual(["mail-001", "mail-003"]);
    expect(JSON.stringify(activity)).not.toContain("mail-002");
    expect(JSON.stringify(activity)).not.toContain("Senior approval is pending");
  });

  it("rejects a forged direct-store report source without changing revision or state", async () => {
    const { store } = await fixture();
    const published = await publishStage2(store);
    const forgedDraft = createDemoWeeklyReportDraftInput();
    forgedDraft.sources.push({
      id: "forged-external-source",
      source_type: "mock_outlook",
      building_id: "bld-cobalt",
      occurred_at: "2026-07-18T11:30:00+09:00",
      share_scope: "external_reportable",
      summary: "Plausible but non-canonical synthetic source",
    });

    await expect(store.draftWeeklyReport({
      actor_id: "usr-manager",
      expected_revision: published.revision,
      draft: forgedDraft,
      occurred_at: "2026-07-18T11:31:00.000Z",
    })).rejects.toThrow(/current|source/i);
    expect(await store.getState()).toEqual(published);
  });

  it("rejects same-ID source summary tampering without persisting confidential content", async () => {
    const { statePath, store } = await fixture();
    const published = await publishStage2(store);
    const tamperedDraft = await loadCanonicalWeeklyReportDraft();
    tamperedDraft.sources[1]!.summary = "Senior approval is pending for confidential incentives.";

    await expect(store.draftWeeklyReport({
      actor_id: "usr-manager",
      expected_revision: published.revision,
      draft: tamperedDraft,
      occurred_at: "2026-07-18T11:31:00.000Z",
    })).rejects.toThrow(/canonical current synthetic source set/);
    expect(await store.getState()).toEqual(published);
    expect(await readFile(statePath, "utf8")).not.toContain("Senior approval is pending");
  });

  it("persists source-content drift as stale before approval", async () => {
    let currentDraft = await loadCanonicalWeeklyReportDraft();
    const { store, service } = await fixture({
      reportDraftLoader: async () => structuredClone(currentDraft),
    });
    const published = await publishStage2(store);
    const drafted = await service.draft({
      actor_id: "usr-manager",
      expected_revision: published.revision,
      occurred_at: "2026-07-18T10:00:00.000Z",
    });
    currentDraft = structuredClone(currentDraft);
    currentDraft.sources[1]!.summary = "Curated subject changed under the same source ID.";

    await expect(service.approve({
      actor_id: "usr-manager",
      expected_revision: drafted.revision,
      report_id: drafted.operations.reports.reports[0]!.id,
      occurred_at: "2026-07-18T10:01:00.000Z",
    })).rejects.toThrow(/stale/);
    const stale = await store.getState();
    expect(stale.revision).toBe(drafted.revision + 1);
    expect(stale.operations.reports.reports[0]!.status).toBe("stale");
    expect(stale.operations.reports.audit.at(-1)).toMatchObject({
      event_type: "report.marked_stale",
      metadata: { source_content_drift: true },
    });
  });

  it("persists material-ID drift as stale before approval", async () => {
    let currentDraft = await loadCanonicalWeeklyReportDraft();
    const { store, service } = await fixture({
      reportDraftLoader: async () => structuredClone(currentDraft),
    });
    const published = await publishStage2(store);
    const drafted = await service.draft({ actor_id: "usr-manager", expected_revision: published.revision });
    currentDraft = structuredClone(currentDraft);
    currentDraft.sources[2]!.id = "mail-003-v2";

    await expect(service.approve({
      actor_id: "usr-manager",
      expected_revision: drafted.revision,
      report_id: drafted.operations.reports.reports[0]!.id,
    })).rejects.toThrow(/stale/);
    const stale = await store.getState();
    expect(stale.operations.reports.reports[0]!.status).toBe("stale");
    expect(stale.operations.reports.audit.at(-1)).toMatchObject({
      event_type: "report.marked_stale",
      metadata: { material_drift: true, source_content_drift: true },
    });
  });

  it("persists recipient-content drift as stale before sandbox send", async () => {
    let currentConfig = await loadDemoRuntimeConfiguration();
    const { store, service } = await fixture({
      configLoader: async () => structuredClone(currentConfig),
    });
    const published = await publishStage2(store);
    const drafted = await service.draft({ actor_id: "usr-manager", expected_revision: published.revision });
    const approved = await service.approve({
      actor_id: "usr-manager",
      expected_revision: drafted.revision,
      report_id: drafted.operations.reports.reports[0]!.id,
    });
    currentConfig = structuredClone(currentConfig);
    currentConfig.reportRecipients!.to[0]!.email = "changed.manager@example.test";

    await expect(service.send({
      actor_id: "usr-manager",
      expected_revision: approved.revision,
      report_id: approved.operations.reports.reports[0]!.id,
      idempotency_key: "blocked-recipient-drift",
    })).rejects.toThrow(/stale/);
    const stale = await store.getState();
    expect(stale.revision).toBe(approved.revision + 1);
    expect(stale.operations.reports.reports[0]!.status).toBe("stale");
    expect(stale.operations.reports.audit.at(-1)).toMatchObject({
      event_type: "report.marked_stale",
      metadata: { recipient_content_drift: true },
    });
    expect(toPublicReportWorkflow(stale).reports[0]!.approval.approved).toBe(false);
  });

  it("persists draft, patch decision, manager approval, and exactly-once sandbox send without changing official data", async () => {
    const { statePath, store, service } = await fixture();
    const published = await publishStage2(store);
    const officialBefore = structuredClone({
      stage: published.stage,
      candidates: published.candidates,
      records: published.records,
      files: published.files,
      audit: published.audit,
    });

    const drafted = await service.draft({
      actor_id: "usr-manager",
      expected_revision: published.revision,
      occurred_at: "2026-07-18T10:00:00.000Z",
    });
    expect(drafted.operations.reports.reports[0]).toMatchObject({
      id: "report-cobalt-2026-w29",
      status: "draft",
      building_id: "bld-cobalt",
      reporting_period: { from: "2026-07-13", to: "2026-07-18" },
      recipients: {
        configuration_id: "recipient-group-cobalt-weekly-v1",
        to: [{ email: "am.manager@example.test", role: "to_landlord_practical" }],
      },
    });
    expect(drafted.operations.reports.reports[0]!.sources.map((source) => source.id)).toEqual([
      "activity-call-cobalt", "mail-001", "mail-003",
    ]);
    expect(await readFile(statePath, "utf8")).not.toContain("Senior approval is pending");

    const proposed = await service.investigate({
      actor_id: "usr-manager",
      expected_revision: drafted.revision,
      report_id: drafted.operations.reports.reports[0]!.id,
      command: "협의 중인 면적 변동 있는지 확인해",
      occurred_at: "2026-07-18T10:01:00.000Z",
      environment: { DEMO_MODE: "true" },
    });
    expect(proposed.operations.reports.reports[0]!.status).toBe("patch_pending");
    expect(proposed.operations.reports.reports[0]!.pending_candidate?.target_building_ids).toEqual(["bld-cobalt"]);

    const rejected = await service.decidePatch({
      actor_id: "usr-manager",
      expected_revision: proposed.revision,
      report_id: proposed.operations.reports.reports[0]!.id,
      decision: "reject",
      occurred_at: "2026-07-18T10:02:00.000Z",
    });
    expect(rejected.operations.reports.reports[0]!.current_sections)
      .toEqual(drafted.operations.reports.reports[0]!.current_sections);

    await expect(service.send({
      actor_id: "usr-manager",
      expected_revision: rejected.revision,
      report_id: rejected.operations.reports.reports[0]!.id,
      idempotency_key: "blocked-before-approval",
    })).rejects.toThrow(/approval/);
    expect(await store.getState()).toEqual(rejected);

    const reproposed = await service.investigate({
      actor_id: "usr-manager",
      expected_revision: rejected.revision,
      report_id: rejected.operations.reports.reports[0]!.id,
      command: "협의 중인 면적 변동 있는지 확인해",
      occurred_at: "2026-07-18T10:02:30.000Z",
      environment: { DEMO_MODE: "true" },
    });
    const accepted = await service.decidePatch({
      actor_id: "usr-manager",
      expected_revision: reproposed.revision,
      report_id: reproposed.operations.reports.reports[0]!.id,
      decision: "accept",
      occurred_at: "2026-07-18T10:02:45.000Z",
    });
    expect(accepted.operations.reports.reports[0]!.accepted_patch_history).toHaveLength(1);
    expect(accepted.operations.reports.reports[0]!.current_sections.changes_since_last_report)
      .toHaveLength(drafted.operations.reports.reports[0]!.current_sections.changes_since_last_report.length + 1);

    const approved = await service.approve({
      actor_id: "usr-manager",
      expected_revision: accepted.revision,
      report_id: accepted.operations.reports.reports[0]!.id,
      occurred_at: "2026-07-18T10:03:00.000Z",
    });
    await expect(service.send({
      actor_id: "usr-manager",
      expected_revision: rejected.revision,
      report_id: approved.operations.reports.reports[0]!.id,
      idempotency_key: "weekly-send-1",
    })).rejects.toThrow(/Revision conflict/);

    const [sentA, sentB] = await Promise.all([
      service.send({ actor_id: "usr-manager", expected_revision: approved.revision,
        report_id: approved.operations.reports.reports[0]!.id, idempotency_key: "weekly-send-1",
        occurred_at: "2026-07-18T10:04:00.000Z" }),
      service.send({ actor_id: "usr-manager", expected_revision: approved.revision,
        report_id: approved.operations.reports.reports[0]!.id, idempotency_key: "weekly-send-1",
        occurred_at: "2026-07-18T10:04:00.000Z" }),
    ]);
    expect(sentA.operations.reports.activities).toHaveLength(1);
    expect(sentB.operations.reports.activities).toHaveLength(1);
    const reloaded = await new DemoFileStore(statePath).getState();
    expect(reloaded.operations.reports.reports[0]!.status).toBe("sent");
    expect(reloaded.operations.reports.activities).toHaveLength(1);
    expect({ stage: reloaded.stage, candidates: reloaded.candidates,
      records: reloaded.records, files: reloaded.files, audit: reloaded.audit }).toEqual(officialBefore);
    const reset = await store.reset({
      actor_id: "usr-manager",
      expected_revision: reloaded.revision,
      occurred_at: "2026-07-18T10:05:00.000Z",
    });
    expect(reset.schema_version).toBe(3);
    expect(reset.operations.reports).toEqual({ reports: [], activities: [], audit: [] });
    expect(reset.audit.at(-1)?.event_type).toBe("demo.reset");
  });

  it("passes only curated external sources to a live patch adapter and leaves state unchanged when the adapter rejects", async () => {
    const { store } = await fixture();
    const published = await publishStage2(store);
    let adapterInput: ReportPatchGenerationAdapterInput | undefined;
    const adapter = async (input: ReportPatchGenerationAdapterInput) => {
      adapterInput = input;
      return {
        command: "이메일 확인해서 이번주 변동사항 업데이트 해",
        building_id: "bld-cobalt",
        findings: [{ category: "activity_summary", finding: "Approved materials prepared", source_activity_ids: ["mail-003"], confidence: 0.99 }],
        operations: [{ section: "activity_summary", operation: "replace",
          before: ["Broker requested current 5F package", "Revised package prepared after publication"],
          after: ["Broker requested current 5F package", "Revised package prepared after publication", "Email review complete"],
          source_activity_ids: ["mail-003"] }],
        unresolved: [],
      };
    };
    const service = createReportWorkflowService({ store, patchAdapter: adapter });
    const drafted = await service.draft({ actor_id: "usr-manager", expected_revision: published.revision });
    const proposed = await service.investigate({
      actor_id: "usr-manager", expected_revision: drafted.revision,
      report_id: drafted.operations.reports.reports[0]!.id,
      command: "이메일 확인해서 이번주 변동사항 업데이트 해",
      environment: { DEMO_MODE: "false", OPENAI_API_KEY: "synthetic", OPENAI_MODEL: "gpt-test" },
    });
    expect(adapterInput).toBeDefined();
    expect(adapterInput?.user).not.toContain("mail-002");
    expect(adapterInput?.user).not.toContain("Senior approval is pending");
    expect(adapterInput?.user).not.toContain("recipient-group-cobalt-weekly-v1");

    const beforeFailure = await service.decidePatch({
      actor_id: "usr-manager", expected_revision: proposed.revision,
      report_id: proposed.operations.reports.reports[0]!.id,
      decision: "reject",
    });
    const rejectingService = createReportWorkflowService({ store, patchAdapter: async () => {
      throw new Error("synthetic adapter failure");
    } });
    await expect(rejectingService.investigate({
      actor_id: "usr-manager", expected_revision: beforeFailure.revision,
      report_id: beforeFailure.operations.reports.reports[0]!.id,
      command: "이메일 확인해서 이번주 변동사항 업데이트 해",
      environment: { DEMO_MODE: "false", OPENAI_API_KEY: "synthetic", OPENAI_MODEL: "gpt-test" },
    })).rejects.toThrow(/synthetic adapter failure/);
    expect(await store.getState()).toEqual(beforeFailure);
  });

  it("fails closed on malformed persisted report and exposes only a curated public DTO", async () => {
    const { statePath, store, service } = await fixture();
    const published = await publishStage2(store);
    const drafted = await service.draft({ actor_id: "usr-manager", expected_revision: published.revision });
    const publicWorkflow = toPublicReportWorkflow(drafted);
    const serialized = JSON.stringify(publicWorkflow);
    expect(serialized).not.toContain("mail-002");
    expect(serialized).not.toContain("Senior approval is pending");
    const forbiddenKeys = ["actor_id", "approved_by", "idempotency_key", "raw_text", "protected_snapshot", "metadata"];
    expect([...collectKeys(publicWorkflow)].filter((key) => forbiddenKeys.includes(key))).toEqual([]);
    expect(publicWorkflow.labels).toEqual({ mode: "DEMO", delivery: "SANDBOX ONLY" });

    const crossBuilding = structuredClone(drafted);
    const foreignReport = structuredClone(crossBuilding.operations.reports.reports[0]!);
    foreignReport.id = "report-foreign-building";
    foreignReport.building_id = "bld-foreign";
    crossBuilding.operations.reports.reports.push(foreignReport);
    expect(() => toPublicReportWorkflow(crossBuilding)).toThrow(/cross-building/);

    const malformed = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;
    const operations = malformed.operations as Record<string, unknown>;
    const reports = operations.reports as { reports: Array<Record<string, unknown>> };
    const currentSections = reports.reports[0]!.current_sections as Record<string, unknown>;
    currentSections.key_issue = "forged report content";
    await writeFile(statePath, JSON.stringify(malformed), "utf8");
    await expect(new DemoFileStore(statePath).getState()).rejects.toThrow(/state is corrupt/);
  });
});
