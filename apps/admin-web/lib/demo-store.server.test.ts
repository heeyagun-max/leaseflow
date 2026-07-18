import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SourceCandidateSchema } from "@leaseflow/ai";
import { renderOperationalPackageBody } from "@leaseflow/domain";
import {
  createInitialDemoState,
  createMobilePublishedSnapshot,
  demoExtractionResult,
  requireCurrentPublishedDemoFile,
  type DemoFileVersion,
  type DemoRecord,
} from "@leaseflow/demo-data";
import { DemoFileStore } from "./demo-store.server";
import { demoRequestExtraction } from "./request-extraction.server";

const tempDirectories: string[] = [];

async function storeFixture(): Promise<{ store: DemoFileStore; statePath: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-stage12-"));
  tempDirectories.push(directory);
  const statePath = path.join(directory, "state.v1.json");
  return { store: new DemoFileStore(statePath), statePath };
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("persistent governed demo store", () => {
  it("returns exactly four Zod-valid deterministic extraction candidates", () => {
    const parsed = SourceCandidateSchema.parse(demoExtractionResult);
    expect(parsed.changes).toHaveLength(4);
    expect(parsed.changes.map((change) => change.field)).toEqual([
      "marketed_area_py", "floor_plan", "rent_free_months", "supported_parking_spaces",
    ]);
  });

  it("persists atomic publication history across store instances and blocks stale plan v1", async () => {
    const { store, statePath } = await storeFixture();
    const initial = await store.getState();
    expect(createMobilePublishedSnapshot(initial)).toMatchObject({
      marketed_area_py: 300,
      rent_free_months: 3,
      supported_parking_spaces: 3,
      floor_plan: { filename: "CFC_5F_plan_v1.svg" },
      blocked_floor_plans: [],
    });

    const extracted = await store.extract(
      {actor_id:"usr-junior",expected_revision:0,occurred_at:"2026-07-18T09:00:00.000Z"},
      demoExtractionResult,
    );
    const confirmed = await store.confirm({actor_id:"usr-junior",expected_revision:extracted.revision,occurred_at:"2026-07-18T09:01:00.000Z"});
    const beforeRejectedPublish = structuredClone(confirmed);
    await expect(store.publish({actor_id:"usr-junior",expected_revision:confirmed.revision,occurred_at:"2026-07-18T09:02:00.000Z"})).rejects.toThrow(/not allowed/);
    expect(await store.getState()).toEqual(beforeRejectedPublish);

    const published = await store.publish({actor_id:"usr-senior",expected_revision:confirmed.revision,occurred_at:"2026-07-18T09:03:00.000Z"});
    const reloaded = await new DemoFileStore(statePath).getState();
    expect(reloaded).toEqual(published);
    expect(reloaded.records.filter((record) => record.version_no === 1).every((record) => record.status === "superseded" && record.valid_to === "2026-07-17")).toBe(true);
    expect(reloaded.records.filter((record) => record.version_no === 2).every((record) => record.status === "published")).toBe(true);
    expect(reloaded.audit.map((event) => event.event_type)).toEqual([
      "source.extracted", "candidate.confirmed", "batch.senior_approved", "batch.published",
    ]);
    expect(createMobilePublishedSnapshot(reloaded)).toMatchObject({
      marketed_area_py: 200,
      rent_free_months: 2,
      supported_parking_spaces: 2,
      floor_plan: { filename: "CFC_5F_plan_v2.svg" },
      blocked_floor_plans: ["CFC_5F_plan_v1.svg"],
    });
    expect(() => requireCurrentPublishedDemoFile(reloaded, "CFC_5F_plan_v1.svg")).toThrow(/Stale floor plan blocked/);
  });

  it("resets deterministically and rejects stale revisions", async () => {
    const { store, statePath } = await storeFixture();
    const initial = await store.getState();
    const extracted = await store.extract({actor_id:"usr-junior",expected_revision:0}, demoExtractionResult);
    await expect(store.confirm({actor_id:"usr-junior",expected_revision:0})).rejects.toThrow(/Revision conflict/);
    expect((await store.getState()).revision).toBe(extracted.revision);
    const reset = await store.reset({
      actor_id:"usr-junior",
      expected_revision:extracted.revision,
      occurred_at:"2026-07-18T10:00:00.000Z",
    });
    expect(reset.revision).toBe(2);
    expect(reset.audit.map((event) => event.event_type)).toEqual(["source.extracted", "demo.reset"]);
    expect({ ...reset, revision: 0, audit: [] }).toEqual(initial);
    await expect(store.confirm({actor_id:"usr-junior",expected_revision:extracted.revision})).rejects.toThrow(/Revision conflict/);
    const secondReset = await store.reset({
      actor_id:"usr-senior",
      expected_revision:reset.revision,
      occurred_at:"2026-07-18T10:01:00.000Z",
    });
    expect(secondReset.revision).toBe(3);
    expect(secondReset.audit.map((event) => event.event_type)).toEqual([
      "source.extracted", "demo.reset", "demo.reset",
    ]);
  });

  it("persists only schema-valid mapped extraction candidates", async () => {
    const { store } = await storeFixture();
    const initial = await store.getState();
    await expect(store.extract({actor_id:"usr-junior",expected_revision:0}, {
      ...demoExtractionResult,
      changes: demoExtractionResult.changes.slice(0, 3),
    })).rejects.toThrow(/exactly 4/);
    expect(await store.getState()).toEqual(initial);
    await expect(store.extract({actor_id:"usr-junior",expected_revision:0}, {
      ...demoExtractionResult,
      changes: [{ ...demoExtractionResult.changes[0]!, proposed_value: { forged: true } }],
    })).rejects.toThrow();
    expect(await store.getState()).toEqual(initial);
  });

  it("fails closed on invalid JSON, strict nested shape, or domain invariants", async () => {
    const { store, statePath } = await storeFixture();
    await writeFile(statePath, "{not-json", "utf8");
    await expect(store.getState()).rejects.toThrow(/state is corrupt/);

    const invalidNested = createInitialDemoState() as unknown as Record<string, unknown>;
    const invalidRecords = invalidNested.records as Array<Record<string, unknown>>;
    invalidRecords[0]!.external_shareable = "yes";
    await writeFile(statePath, JSON.stringify(invalidNested), "utf8");
    await expect(store.getState()).rejects.toThrow(/state is corrupt/);

    const invalidInvariant = createInitialDemoState();
    invalidInvariant.records[1] = {
      ...invalidInvariant.records[1]!,
      status: "published",
    };
    await writeFile(statePath, JSON.stringify(invalidInvariant), "utf8");
    await expect(store.getState()).rejects.toThrow(/multiple current published versions/);
  });

  it("scopes current and blocked mobile data to the Cobalt 5F field and file type", () => {
    const state = createInitialDemoState();
    const otherRecords: DemoRecord[] = [
      {id:"other-area-v1",building_id:"bld-other",kind:"availability",floor:"5F",field:"marketed_area_py",value:999,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-rf-v1",building_id:"bld-other",kind:"term",floor:"5F",field:"rent_free_months",value:9,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-park-v1",building_id:"bld-other",kind:"term",floor:"5F",field:"supported_parking_spaces",value:9,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
    ];
    const otherFiles: DemoFileVersion[] = [
      {id:"other-plan-v1",building_id:"bld-other",floor:"5F",filename:"other-plan-v1.svg",file_type:"floor_plan",version_no:1,status:"superseded",valid_from:"2026-06-01",valid_to:"2026-07-17",superseded:true,external_shareable:true},
      {id:"other-plan-v2",building_id:"bld-other",floor:"5F",filename:"other-plan-v2.svg",file_type:"floor_plan",version_no:2,status:"published",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
    ];
    state.records.push(...otherRecords);
    state.files.push(...otherFiles);
    expect(createMobilePublishedSnapshot(state)).toMatchObject({
      marketed_area_py: 300,
      rent_free_months: 3,
      supported_parking_spaces: 3,
      floor_plan: { filename: "CFC_5F_plan_v1.svg" },
      blocked_floor_plans: [],
    });
  });

  it("persists the governed mobile package flow without changing official data", async () => {
    const { store, statePath } = await storeFixture();
    const extracted = await store.extract({ actor_id: "usr-junior", expected_revision: 0 }, demoExtractionResult);
    const confirmed = await store.confirm({ actor_id: "usr-junior", expected_revision: extracted.revision });
    const published = await store.publish({ actor_id: "usr-senior", expected_revision: confirmed.revision });
    const officialBefore = { records: published.records, files: published.files, stage: published.stage, candidates: published.candidates };
    const imported = await store.importRequest({
      actor_id: "usr-manager", expected_revision: published.revision, request_id: "request-call-1", source: "call",
      source_id: "activity-call-cobalt", raw_text: "synthetic request", extraction: demoRequestExtraction("call"),
    });
    const requestConfirmed = await store.confirmRequest({ actor_id: "usr-manager", expected_revision: imported.revision, request_id: "request-call-1" });
    const drafted = await store.draftPackage({ actor_id: "usr-manager", expected_revision: requestConfirmed.revision, request_id: "request-call-1" });
    expect(drafted.operations.packages[0]).toMatchObject({
      status: "draft",
      facts: [
        { field: "marketed_area", value: 200, version_id: "av-cobalt-5f-v2" },
        { field: "rent_free", value: 2, version_id: "term-cobalt-rf-v2" },
        { field: "supported_parking", value: 2, version_id: "term-cobalt-park-v2" },
      ],
      files: [{ filename: "CFC_5F_plan_v2.svg", version_id: "file-cobalt-plan-v2" }],
      recipients: { configuration_id: "recipient-group-broker-package-cobalt-v1", to: ["alex.chen@northbridge-demo.example"] },
      unresolved: [],
    });
    await expect(store.sendPackage({ actor_id: "usr-manager", expected_revision: drafted.revision, package_id: "pkg-request-call-1", idempotency_key: "sandbox-send-1" })).rejects.toThrow(/approval/);
    const approved = await store.approvePackage({ actor_id: "usr-manager", expected_revision: drafted.revision, package_id: "pkg-request-call-1" });
    const [sentA, sentB] = await Promise.all([
      store.sendPackage({ actor_id: "usr-manager", expected_revision: approved.revision, package_id: "pkg-request-call-1", idempotency_key: "sandbox-send-1" }),
      store.sendPackage({ actor_id: "usr-manager", expected_revision: approved.revision, package_id: "pkg-request-call-1", idempotency_key: "sandbox-send-1" }),
    ]);
    expect(sentA.operations.activities).toHaveLength(1);
    expect(sentB.operations.activities).toHaveLength(1);
    const reloaded = await new DemoFileStore(statePath).getState();
    expect(reloaded.operations.activities).toHaveLength(1);
    expect({ records: reloaded.records, files: reloaded.files, stage: reloaded.stage, candidates: reloaded.candidates }).toEqual(officialBefore);
    const reset = await store.reset({ actor_id: "usr-manager", expected_revision: reloaded.revision, occurred_at: "2026-07-18T12:00:00.000Z" });
    expect(reset.revision).toBe(reloaded.revision + 1);
    expect(reset.operations).toEqual({ requests: [], packages: [], activities: [], audit: [] });
    expect(reset.audit.at(-1)?.event_type).toBe("demo.reset");
  });

  it("rejects protected-material edits and configuration divergence without changing state", async () => {
    const { store, statePath } = await storeFixture();
    const extracted = await store.extract({ actor_id: "usr-junior", expected_revision: 0 }, demoExtractionResult);
    const confirmed = await store.confirm({ actor_id: "usr-junior", expected_revision: extracted.revision });
    const published = await store.publish({ actor_id: "usr-senior", expected_revision: confirmed.revision });
    const imported = await store.importRequest({ actor_id: "usr-manager", expected_revision: published.revision, request_id: "request-call-1", source: "call", source_id: "call", raw_text: "synthetic", extraction: demoRequestExtraction("call") });
    const requestConfirmed = await store.confirmRequest({ actor_id: "usr-manager", expected_revision: imported.revision, request_id: "request-call-1" });
    const drafted = await store.draftPackage({ actor_id: "usr-manager", expected_revision: requestConfirmed.revision, request_id: "request-call-1" });
    for (const body of [drafted.operations.packages[0]!.body.replace("200 py", "300 py"), drafted.operations.packages[0]!.body.replace(/^Attachment:.*$/m, ""), `${drafted.operations.packages[0]!.body}\nInvented support: 12 months`]) {
      await expect(store.proposePackageEdit({ actor_id: "usr-manager", expected_revision: drafted.revision, package_id: "pkg-request-call-1", subject: drafted.operations.packages[0]!.subject, body, instruction: "malicious" })).rejects.toThrow(/protected|alter/);
      expect(await store.getState()).toEqual(drafted);
    }

    const divergent = new DemoFileStore(store.storePath, async () => ({
      access: { configuration_id: "access-v2", users: [{ user_id: "usr-manager", building_ids: ["bld-cobalt"] }] },
      recipients: { id: "forged", building_id: "bld-cobalt", purpose: "broker_package", recipient_name: "Alex Chen", recipient_organization: "Northbridge Advisory", to: ["forged@example.test"], cc: [] },
    }));
    await expect(divergent.approvePackage({ actor_id: "usr-manager", expected_revision: drafted.revision, package_id: "pkg-request-call-1" })).rejects.toThrow(/diverged/);
    expect(await store.getState()).toEqual(drafted);

    const forged = structuredClone(drafted);
    forged.operations.packages[0]!.body = forged.operations.packages[0]!.body.replace("200 py", "300 py");
    await writeFile(statePath, JSON.stringify(forged), "utf8");
    await expect(store.approvePackage({ actor_id: "usr-manager", expected_revision: forged.revision, package_id: "pkg-request-call-1" })).rejects.toThrow(/protected|altered/);
    expect(await store.getState()).toEqual(forged);
    forged.operations.packages[0]!.status = "approved";
    forged.operations.packages[0]!.approved_by = "usr-manager";
    forged.operations.packages[0]!.approved_at = "2026-07-18T12:00:00.000Z";
    await writeFile(statePath, JSON.stringify(forged), "utf8");
    await expect(store.sendPackage({ actor_id: "usr-manager", expected_revision: forged.revision, package_id: "pkg-request-call-1", idempotency_key: "forged-send-key" })).rejects.toThrow(/protected|altered/);
    expect(await store.getState()).toEqual(forged);
  });

  it("rejects forged canonical facts and files at approval, send, and idempotent resend", async () => {
    const { store, statePath } = await storeFixture();
    const extracted = await store.extract({ actor_id: "usr-junior", expected_revision: 0 }, demoExtractionResult);
    const confirmed = await store.confirm({ actor_id: "usr-junior", expected_revision: extracted.revision });
    const published = await store.publish({ actor_id: "usr-senior", expected_revision: confirmed.revision });
    const imported = await store.importRequest({ actor_id: "usr-manager", expected_revision: published.revision, request_id: "request-call-1", source: "call", source_id: "call", raw_text: "synthetic", extraction: demoRequestExtraction("call") });
    const requestConfirmed = await store.confirmRequest({ actor_id: "usr-manager", expected_revision: imported.revision, request_id: "request-call-1" });
    const drafted = await store.draftPackage({ actor_id: "usr-manager", expected_revision: requestConfirmed.revision, request_id: "request-call-1" });

    const tamperCases: Array<(state: typeof drafted) => void> = [
      (state) => { state.operations.packages[0]!.facts[0]!.value = 999; },
      (state) => { state.operations.packages[0]!.facts[0]!.source_pointer = "Forged registry pointer"; },
      (state) => { state.operations.packages[0]!.files[0]!.filename = "forged-current-plan.svg"; },
    ];

    for (const tamper of tamperCases) {
      const forged = structuredClone(drafted);
      tamper(forged);
      const pkg = forged.operations.packages[0]!;
      pkg.body = renderOperationalPackageBody(pkg.facts, pkg.files, "neutral");
      await writeFile(statePath, JSON.stringify(forged), "utf8");
      await expect(store.approvePackage({ actor_id: "usr-manager", expected_revision: forged.revision, package_id: pkg.id })).rejects.toThrow(/canonical published material/);
      expect(await store.getState()).toEqual(forged);

      pkg.status = "approved";
      pkg.approved_by = "usr-manager";
      pkg.approved_at = "2026-07-18T12:00:00.000Z";
      await writeFile(statePath, JSON.stringify(forged), "utf8");
      await expect(store.sendPackage({ actor_id: "usr-manager", expected_revision: forged.revision, package_id: pkg.id, idempotency_key: "forged-send-key" })).rejects.toThrow(/canonical published material/);
      expect(await store.getState()).toEqual(forged);

      pkg.status = "sent";
      pkg.sent_at = "2026-07-18T12:01:00.000Z";
      pkg.idempotency_key = "forged-send-key";
      await writeFile(statePath, JSON.stringify(forged), "utf8");
      await expect(store.sendPackage({ actor_id: "usr-manager", expected_revision: forged.revision, package_id: pkg.id, idempotency_key: "forged-send-key" })).rejects.toThrow(/canonical published material/);
      expect(await store.getState()).toEqual(forged);
    }
  });
});
