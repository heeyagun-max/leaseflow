import { describe, expect, it } from "vitest";
import {
  assertTransition,
  assertWeeklyReportIntegrity,
  approveOperationalPackage,
  approveWeeklyReport,
  canPerform,
  canSendExternal,
  confirmSourceAsset,
  confirmCandidates,
  confirmOperationalRequest,
  createInitialOperationalState,
  createInitialWeeklyReportState,
  createWeeklyReportDraft,
  decidePackageEdit,
  decideWeeklyReportPatch,
  draftOperationalPackage,
  importOperationalRequest,
  markWeeklyReportStale,
  publishConfirmedBatch,
  publishSourceAsset,
  proposePackageEdit,
  proposeWeeklyReportPatch,
  recordExtraction,
  registerSourceAsset,
  renderOperationalPackageBody,
  selectCurrentFloorPlan,
  selectCurrentPublished,
  selectExternalReportableSources,
  selectExternallyVisibleAssets,
  sendOperationalPackage,
  sendWeeklyReport,
  validateLandlordRecipients,
  WEEKLY_REPORT_INVESTIGATION_COMMANDS,
  type CandidateChange,
  type ConfiguredReportRecipients,
  type CreateWeeklyReportDraftInput,
  type FileVersion,
  type GovernedPublicationState,
  type GovernedAssetRegistry,
  type VersionedRecord,
  type WeeklyReportPatchCandidate,
  type WeeklyReportSections,
  type WeeklyReportState,
} from "./index";

function registeredAsset(overrides: Partial<Parameters<typeof registerSourceAsset>[1]> = {}): GovernedAssetRegistry {
  return registerSourceAsset({ assets: [] }, {
    id: "asset-plan-v1",
    observed_filename: "Cobalt_5F_plan_v1_20260718.svg",
    synthetic_fingerprint: "synthetic:plan-v1",
    mime_type: "image/svg+xml",
    byte_size: 1200,
    building_alias_candidate: "Cobalt Finance Center",
    building_id: "bld-cobalt",
    source_organization: "Synthetic Asset Studio",
    linked_file_version_id: "file-cobalt-plan-v1",
    occurred_at: "2026-07-18T01:00:00.000Z",
    ...overrides,
  });
}

describe("governed source asset registry", () => {
  const steward = { id: "usr-junior", role: "data_steward" as const };
  const senior = { id: "usr-senior", role: "senior_reviewer" as const };

  function confirm(registry: GovernedAssetRegistry, assetId = registry.assets[0]!.id, shareable = true) {
    return confirmSourceAsset(registry, {
      asset_id: assetId,
      building_id: "bld-cobalt",
      externally_shareable: shareable,
      actor: steward,
      occurred_at: "2026-07-18T02:00:00.000Z",
    });
  }

  function publish(registry: GovernedAssetRegistry, assetId = registry.assets.at(-1)!.id) {
    return publishSourceAsset(registry, {
      asset_id: assetId,
      actor: senior,
      occurred_at: "2026-07-18T03:00:00.000Z",
      current_linked_file_versions: new Map([
        ["file-cobalt-plan-v1", "bld-cobalt"],
        ["file-cobalt-plan-v2", "bld-cobalt"],
      ]),
    });
  }

  it("deduplicates exact synthetic fingerprints while retaining both observed names", () => {
    const first = registeredAsset();
    const second = registerSourceAsset(first, {
      ...{
        id: "asset-plan-copy",
        observed_filename: "renamed_current_plan.svg",
        synthetic_fingerprint: "synthetic:plan-v1",
        mime_type: "image/svg+xml",
        byte_size: 1200,
        building_alias_candidate: "Cobalt Finance Center",
        building_id: "bld-cobalt",
        source_organization: "Synthetic Asset Studio",
        occurred_at: "2026-07-18T01:05:00.000Z",
      },
    });
    expect(second.assets).toHaveLength(1);
    expect(second.assets[0]?.observed_filenames).toEqual([
      "Cobalt_5F_plan_v1_20260718.svg",
      "renamed_current_plan.svg",
    ]);
  });

  it("treats a filename date as artifact date, never effective date", () => {
    const asset = registeredAsset().assets[0]!;
    expect(asset.artifact_date).toBe("2026-07-18");
    expect(asset.effective_date).toBeNull();
  });

  it("separates portfolio editions into explicit version families and segmentation", () => {
    const first = registeredAsset({ id: "portfolio-june", observed_filename: "Synthetic_Portfolio_20260630.pdf", synthetic_fingerprint: "synthetic:portfolio-june", mime_type: "application/pdf" });
    const second = registerSourceAsset(first, {
      id: "portfolio-july", observed_filename: "Synthetic_Portfolio_20260718.pdf", synthetic_fingerprint: "synthetic:portfolio-july",
      mime_type: "application/pdf", byte_size: 1400, building_alias_candidate: "Portfolio", building_id: "bld-cobalt",
      source_organization: "Synthetic Asset Studio", occurred_at: "2026-07-18T01:05:00.000Z",
    });
    expect(second.assets.map((asset) => asset.version_family)).toEqual([
      "portfolio-edition:2026-06-30",
      "portfolio-edition:2026-07-18",
    ]);
    expect(second.assets.every((asset) => asset.segmentation_marker === "portfolio-wide")).toBe(true);
  });

  it.each([
    ["Synthetic_area_register_20260718.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["Synthetic_legal_agreement_20260718.pdf", "application/pdf"],
  ])("keeps restricted workbook/legal source out of external output: %s", (filename, mimeType) => {
    const registry = registeredAsset({ observed_filename: filename, mime_type: mimeType, synthetic_fingerprint: `synthetic:${filename}` });
    expect(() => confirm(registry)).toThrow(/Restricted legal or workbook/);
    expect(selectExternallyVisibleAssets(registry.assets)).toEqual([]);
  });

  it("routes DWG-like input to unsupported manual review", () => {
    const asset = registeredAsset({ observed_filename: "Cobalt_5F_plan_v3.dwg", mime_type: "application/acad", synthetic_fingerprint: "synthetic:dwg" }).assets[0]!;
    expect(asset).toMatchObject({ classification_state: "manual_review", extraction_method: "manual", extraction_state: "unsupported" });
    expect(() => confirm({ assets: [asset] })).toThrow(/supported classification candidates/);
  });

  it("recognizes the common perspetive filename typo as a perspective render", () => {
    const asset = registeredAsset({
      observed_filename: "Synthetic_Cobalt_perspetive_20260718.svg",
      synthetic_fingerprint: "synthetic:perspetive-render",
    }).assets[0]!;
    expect(asset.document_category).toBe("perspective_render");
  });

  it("blocks unresolved aliases and wrong-building confirmations", () => {
    const unresolved = registeredAsset({ building_id: null, building_alias_candidate: "Unknown Tower" });
    expect(() => confirm(unresolved)).toThrow(/Unresolved building alias/);
    const wrong = registeredAsset({ building_id: "bld-other" });
    expect(() => confirm(wrong)).toThrow(/Wrong-building/);
    const forgedWrongBuilding = {
      assets: wrong.assets.map((asset) => ({
        ...asset,
        status: "steward_confirmed" as const,
        classification_state: "confirmed" as const,
        externally_shareable: true,
        authorized: true,
      })),
    };
    expect(() => publish(forgedWrongBuilding)).toThrow(/matching current linked file version/);
  });

  it("publishing a newer floor plan supersedes and blocks the old plan", () => {
    const oldPublished = publish(confirm(registeredAsset()));
    const withNew = registerSourceAsset(oldPublished, {
      id: "asset-plan-v2", observed_filename: "Cobalt_5F_plan_v2_20260719.svg", synthetic_fingerprint: "synthetic:plan-v2",
      mime_type: "image/svg+xml", byte_size: 1300, building_alias_candidate: "Cobalt Finance Center", building_id: "bld-cobalt",
      source_organization: "Synthetic Asset Studio", occurred_at: "2026-07-19T01:00:00.000Z",
      linked_file_version_id: "file-cobalt-plan-v2",
    });
    const published = publish(confirm(withNew, "asset-plan-v2"), "asset-plan-v2");
    expect(published.assets.find((asset) => asset.id === "asset-plan-v1")).toMatchObject({ status: "superseded", active: false });
    expect(published.assets.find((asset) => asset.id === "asset-plan-v2")).toMatchObject({ status: "published", supersedes: "asset-plan-v1" });
    expect(selectExternallyVisibleAssets(published.assets).map((asset) => asset.id)).toEqual(["asset-plan-v2"]);
  });

  it("publishing a newer building-flyer edition supersedes the prior version family", () => {
    const oldRegistered = registeredAsset({
      id: "flyer-june",
      observed_filename: "Cobalt_building_flyer_202606.pdf",
      synthetic_fingerprint: "synthetic:flyer-june",
      mime_type: "application/pdf",
      linked_file_version_id: null,
    });
    const oldPublished = publish(confirm(oldRegistered, "flyer-june"), "flyer-june");
    const withNew = registerSourceAsset(oldPublished, {
      id: "flyer-july", observed_filename: "Cobalt_building_flyer_202607.pdf", synthetic_fingerprint: "synthetic:flyer-july",
      mime_type: "application/pdf", byte_size: 1500, building_alias_candidate: "Cobalt Finance Center", building_id: "bld-cobalt",
      source_organization: "Synthetic Asset Studio", occurred_at: "2026-07-19T01:00:00.000Z",
    });
    const published = publish(confirm(withNew, "flyer-july"), "flyer-july");

    expect(published.assets.find((asset) => asset.id === "flyer-june")).toMatchObject({ status: "superseded", active: false });
    expect(published.assets.find((asset) => asset.id === "flyer-july")).toMatchObject({
      status: "published",
      supersedes: "flyer-june",
      version_family: "building-flyer:cobalt-building-flyer",
    });
    expect(selectExternallyVisibleAssets(published.assets).map((asset) => asset.id)).toEqual(["flyer-july"]);
  });

  it("admits only assets satisfying all five external gates", () => {
    const published = publish(confirm(registeredAsset()));
    const good = published.assets[0]!;
    const failedGates = [
      { ...good, id: "not-published", status: "steward_confirmed" as const },
      { ...good, id: "inactive", active: false },
      { ...good, id: "not-current", version_family: "stale-family" },
      { ...good, id: "unauthorized", authorized: false },
      { ...good, id: "not-shareable", externally_shareable: false },
      { ...good, id: "current-successor", version_family: "stale-family", supersedes: "not-current", externally_shareable: false },
    ];
    expect(selectExternallyVisibleAssets([good, ...failedGates]).map((asset) => asset.id)).toEqual([good.id]);
  });
});

const versions: VersionedRecord[] = [
  {id:"v1", building_id:"b1", version_no:1, status:"superseded", valid_from:"2026-06-01", valid_to:"2026-07-17", superseded:true, external_shareable:true},
  {id:"v2", building_id:"b1", version_no:2, status:"published", valid_from:"2026-07-18", valid_to:null, superseded:false, external_shareable:true},
];

describe("governed version selection", () => {
  it("selects only the current published version", () => {
    expect(selectCurrentPublished(versions, new Date("2026-07-18T00:00:00Z"))?.id).toBe("v2");
  });

  it("fails closed when more than one current published version exists", () => {
    expect(() => selectCurrentPublished([
      {...versions[1]!, id:"duplicate"},
      versions[1]!,
    ], new Date("2026-07-18T00:00:00Z"))).toThrow(/multiple current published/);
  });

  it("blocks a superseded floor plan", () => {
    const files: FileVersion[] = [
      {...versions[0]!, floor:"5F", filename:"plan-v1.svg"},
      {...versions[1]!, floor:"5F", filename:"plan-v2.svg"},
    ];
    expect(selectCurrentFloorPlan(files, "b1", "5F", new Date("2026-07-18T00:00:00Z")).filename).toBe("plan-v2.svg");
  });

  it("separates junior confirmation from senior publication", () => {
    expect(canPerform("data_steward", "candidate.confirm")).toBe(true);
    expect(canPerform("data_steward", "record.publish")).toBe(false);
    expect(canPerform("senior_reviewer", "record.publish")).toBe(true);
    expect(canPerform("lm_manager", "package.send")).toBe(true);
    expect(canPerform("lm_member", "package.send")).toBe(false);
  });

  it("requires landlord and LM recipient roles", () => {
    expect(() => validateLandlordRecipients({
      to:[{email:"a@example.test", role:"to_landlord_practical"}],
      cc:[
        {email:"b@example.test", role:"cc_landlord_team"},
        {email:"c@example.test", role:"cc_landlord_exec"},
        {email:"d@example.test", role:"cc_lm_team"},
        {email:"e@example.test", role:"cc_lm_exec"},
      ],
    })).not.toThrow();
  });

  it("blocks send until approval and clean records", () => {
    expect(canSendExternal({approved:true, unresolvedCount:0, facts:[versions[1]!], files:[versions[1]!]})).toBe(true);
    expect(canSendExternal({approved:false, unresolvedCount:0, facts:[versions[1]!], files:[versions[1]!]})).toBe(false);
  });
});

describe("weekly landlord report governance", () => {
  const manager = { id: "usr-manager", role: "lm_manager" as const };
  const member = { id: "usr-member", role: "lm_member" as const };
  const currentMaterialIds = new Set(["activity-1", "outlook-1", "area-v2", "plan-v2"]);
  const recipients: ConfiguredReportRecipients = {
    configuration_id: "recipient-config-v1",
    to: [{ email: "am.manager@example.test", role: "to_landlord_practical" }],
    cc: [
      { email: "am.team@example.test", role: "cc_landlord_team" },
      { email: "am.exec@example.test", role: "cc_landlord_exec" },
      { email: "lm.team@example.test", role: "cc_lm_team" },
      { email: "lm.exec@example.test", role: "cc_lm_exec" },
    ],
  };
  const sections: WeeklyReportSections = {
    key_issue: "5F marketed area and floor plan revised after partial occupancy.",
    changes_since_last_report: ["Marketed area 300 py → 200 py"],
    activity_summary: ["Broker requested current 5F package"],
    negotiated_area_floor_changes: [],
    competitor_buildings: [],
    blocker_and_pending_approval: [],
    next_actions: [{ action: "Confirm broker feedback", owner: "LM Manager", due_date: "2026-07-20" }],
  };
  const draftInput: CreateWeeklyReportDraftInput = {
    id: "report-cobalt-2026-w29",
    building_id: "bld-cobalt",
    reporting_period: { from: "2026-07-13", to: "2026-07-18" },
    sections,
    sources: [
      {
        id: "activity-1",
        source_type: "leaseflow_activity",
        building_id: "bld-cobalt",
        occurred_at: "2026-07-17T06:00:00.000Z",
        share_scope: "external_reportable",
        summary: "Current package sent to broker.",
      },
      {
        id: "outlook-1",
        source_type: "mock_outlook",
        building_id: "bld-cobalt",
        occurred_at: "2026-07-18T02:00:00.000Z",
        share_scope: "external_reportable",
        summary: "Negotiated area changed to 200 py.",
      },
    ],
    attachments: [{
      id: "attachment-plan",
      building_id: "bld-cobalt",
      version_id: "plan-v2",
      filename: "CFC_5F_plan_v2.svg",
    }],
    material_version_ids: ["area-v2"],
    recipients,
    cover: {
      subject: "[Weekly Report] Cobalt Finance Center 2026-07-13–2026-07-18",
      body: "Please find the approved building-specific weekly report attached.",
    },
  };

  function drafted(input: CreateWeeklyReportDraftInput = draftInput): WeeklyReportState {
    return createWeeklyReportDraft(
      createInitialWeeklyReportState(),
      input,
      currentMaterialIds,
      member,
      "2026-07-18T03:00:00.000Z",
    );
  }

  function areaPatch(id = "patch-area"): WeeklyReportPatchCandidate {
    return {
      id,
      command: "협의 중인 면적 변동 있는지 확인해",
      target_building_ids: ["bld-cobalt"],
      findings: [{
        category: "negotiated_area",
        finding: "Marketed area changed from 300 py to 200 py.",
        source_reference_ids: ["outlook-1"],
        confidence: 0.99,
      }],
      operations: [{
        section: "negotiated_area_floor_changes",
        operation: "append",
        before: [],
        after: ["Marketed area 300 py → 200 py"],
        source_reference_ids: ["outlook-1"],
      }],
      unresolved: [],
    };
  }

  it("defines explicit report permissions", () => {
    expect(canPerform("lm_manager", "report.prepare")).toBe(true);
    expect(canPerform("lm_manager", "report.approve")).toBe(true);
    expect(canPerform("lm_manager", "report.send")).toBe(true);
    expect(canPerform("lm_member", "report.prepare")).toBe(true);
    expect(canPerform("lm_member", "report.approve")).toBe(false);
    expect(canPerform("team_lead", "report.approve")).toBe(true);
  });

  it("pins all five commands and fails closed for legacy sources without share scope", () => {
    expect(WEEKLY_REPORT_INVESTIGATION_COMMANDS).toEqual([
      "통화내용 확인해서 이번주 변동사항 업데이트 해",
      "이메일 확인해서 이번주 변동사항 업데이트 해",
      "협의 중인 면적 변동 있는지 확인해",
      "협의 중인 층 변동 있는지 확인해",
      "메일이랑 전화 확인해서 경쟁빌딩 파악해봐",
    ]);
    const legacySchemaV2Activity = {
      id: "legacy-activity",
      source_type: "leaseflow_activity",
      building_id: "bld-cobalt",
      occurred_at: "2026-07-18T00:00:00.000Z",
      summary: "Legacy row without share scope",
    };
    expect(selectExternalReportableSources(
      [legacySchemaV2Activity, draftInput.sources[0]],
      "bld-cobalt",
      new Set(["legacy-activity", "activity-1"]),
    ).map((source) => source.id)).toEqual(["activity-1"]);
  });

  it("creates a building-specific draft from copied configured recipients and current external sources", () => {
    const input = structuredClone(draftInput);
    const state = drafted(input);
    input.recipients.to[0]!.email = "tampered@example.test";
    input.sources[0]!.summary = "tampered";
    input.sections.key_issue = "tampered";

    expect(state.reports[0]).toMatchObject({
      id: "report-cobalt-2026-w29",
      building_id: "bld-cobalt",
      status: "draft",
      recipients: { configuration_id: "recipient-config-v1" },
      approval: { approved_by: null, approved_at: null },
      delivery: { sent_at: null, idempotency_key: null },
    });
    expect(state.reports[0]?.recipients.to[0]?.email).toBe("am.manager@example.test");
    expect(state.reports[0]?.sources[0]?.summary).toBe("Current package sent to broker.");
    expect(state.reports[0]?.current_sections.key_issue).toBe(sections.key_issue);
    expect(state.audit.map((event) => event.id)).toEqual(["report-audit-1"]);
  });

  it("admits only current, external-reportable, building-scoped sources and attachments", () => {
    expect(() => drafted({
      ...draftInput,
      sources: draftInput.sources.map((source, index) => index === 0
        ? { ...source, building_id: "bld-other" }
        : source),
    })).toThrow(/building-scoped/);
    expect(() => drafted({
      ...draftInput,
      attachments: draftInput.attachments.map((attachment) => ({
        ...attachment,
        building_id: "bld-other",
      })),
    })).toThrow(/attachments.*building-scoped/);
    expect(() => createWeeklyReportDraft(
      createInitialWeeklyReportState(),
      draftInput,
      new Set(["outlook-1", "area-v2", "plan-v2"]),
      member,
      "2026-07-18T03:00:00.000Z",
    )).toThrow(/current.*external_reportable/);
  });

  it("proposes a source-backed scoped patch without mutating the report body, then replays acceptance", () => {
    const before = drafted();
    const originalReport = structuredClone(before.reports[0]!);
    const proposed = proposeWeeklyReportPatch(
      before,
      draftInput.id,
      areaPatch(),
      member,
      "2026-07-18T03:01:00.000Z",
    );
    expect(before.reports[0]).toEqual(originalReport);
    expect(proposed.reports[0]?.status).toBe("patch_pending");
    expect(proposed.reports[0]?.current_sections).toEqual(originalReport.current_sections);
    expect(proposed.reports[0]?.pending_candidate?.id).toBe("patch-area");

    const accepted = decideWeeklyReportPatch(
      proposed,
      draftInput.id,
      "accept",
      member,
      "2026-07-18T03:02:00.000Z",
    );
    expect(accepted.reports[0]?.current_sections.negotiated_area_floor_changes)
      .toEqual(["Marketed area 300 py → 200 py"]);
    expect(accepted.reports[0]?.accepted_patch_history).toHaveLength(1);
    expect(() => assertWeeklyReportIntegrity(accepted.reports[0]!)).not.toThrow();
    expect(() => assertWeeklyReportIntegrity({
      ...accepted.reports[0]!,
      current_sections: { ...accepted.reports[0]!.current_sections, key_issue: "uncontrolled rewrite" },
    })).toThrow(/accepted patch replay/);
  });

  it("rejects a pending patch without changing current sections or accepted history", () => {
    const proposed = proposeWeeklyReportPatch(
      drafted(),
      draftInput.id,
      areaPatch(),
      manager,
      "2026-07-18T03:01:00.000Z",
    );
    const rejected = decideWeeklyReportPatch(
      proposed,
      draftInput.id,
      "reject",
      manager,
      "2026-07-18T03:02:00.000Z",
    );
    expect(rejected.reports[0]?.current_sections).toEqual(sections);
    expect(rejected.reports[0]?.accepted_patch_history).toEqual([]);
    expect(rejected.reports[0]?.pending_candidate).toBeNull();
    expect(rejected.audit.at(-1)?.event_type).toBe("report.patch_rejected");
  });

  it("blocks cross-building, unbacked, unresolved, and protected-field patch attempts", () => {
    const base = drafted();
    expect(() => proposeWeeklyReportPatch(
      base,
      draftInput.id,
      { ...areaPatch(), target_building_ids: ["bld-other"] },
      manager,
      "2026-07-18T03:01:00.000Z",
    )).toThrow(/one matching building/);
    expect(() => proposeWeeklyReportPatch(
      base,
      draftInput.id,
      {
        ...areaPatch(),
        operations: areaPatch().operations.map((operation) => ({
          ...operation,
          source_reference_ids: ["internal-only-source"],
        })),
      },
      manager,
      "2026-07-18T03:01:00.000Z",
    )).toThrow(/unavailable source/);
    expect(() => proposeWeeklyReportPatch(
      base,
      draftInput.id,
      {
        ...areaPatch(),
        operations: [{
          section: "building_id" as keyof WeeklyReportSections,
          operation: "replace",
          before: "bld-cobalt",
          after: "bld-other",
          source_reference_ids: ["outlook-1"],
        }],
      },
      manager,
      "2026-07-18T03:01:00.000Z",
    )).toThrow(/cannot alter protected field/);
    const pendingUnresolved = proposeWeeklyReportPatch(
      base,
      draftInput.id,
      { ...areaPatch(), unresolved: [{ field: "area", question: "Which area is approved?" }] },
      manager,
      "2026-07-18T03:01:00.000Z",
    );
    expect(() => decideWeeklyReportPatch(
      pendingUnresolved,
      draftInput.id,
      "accept",
      manager,
      "2026-07-18T03:02:00.000Z",
    )).toThrow(/unresolved/);
    expect(() => assertWeeklyReportIntegrity({
      ...base.reports[0]!,
      recipients: { ...base.reports[0]!.recipients, configuration_id: "invented-config" },
    })).toThrow(/protected building, period, recipients, sources, attachments, material IDs, or cover/);
  });

  it("requires LM Manager approval, clean state, configured recipients, integrity, and current material", () => {
    const base = drafted();
    expect(() => approveWeeklyReport(
      base,
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      member,
      "2026-07-18T03:03:00.000Z",
    )).toThrow(/LM Manager approval/);
    expect(() => approveWeeklyReport(
      base,
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      { id: "usr-lead", role: "team_lead" },
      "2026-07-18T03:03:00.000Z",
    )).toThrow(/LM Manager approval/);
    expect(() => approveWeeklyReport(
      base,
      draftInput.id,
      new Set(["activity-1"]),
      recipients.configuration_id,
      manager,
      "2026-07-18T03:03:00.000Z",
    )).toThrow(/stale/);
    expect(() => approveWeeklyReport(
      base,
      draftInput.id,
      currentMaterialIds,
      "recipient-config-v2",
      manager,
      "2026-07-18T03:03:00.000Z",
    )).toThrow(/recipient configuration changed/);

    const approved = approveWeeklyReport(
      base,
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:03:00.000Z",
    );
    expect(approved.reports[0]).toMatchObject({
      status: "approved",
      approval: { approved_by: "usr-manager", approved_at: "2026-07-18T03:03:00.000Z" },
    });
  });

  it("sends in the sandbox exactly once and rejects a cross-report idempotency collision", () => {
    const approved = approveWeeklyReport(
      drafted(),
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:03:00.000Z",
    );
    const sent = sendWeeklyReport(
      approved,
      draftInput.id,
      "report-send-key",
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:04:00.000Z",
    );
    expect(sent.activities).toEqual([expect.objectContaining({
      id: "report-activity-1",
      event_type: "report.sent.sandbox",
      report_id: draftInput.id,
      building_id: "bld-cobalt",
    })]);
    expect(sendWeeklyReport(
      sent,
      draftInput.id,
      "report-send-key",
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:05:00.000Z",
    )).toBe(sent);

    const secondDraft = createWeeklyReportDraft(
      sent,
      {
        ...draftInput,
        id: "report-cobalt-2026-w30",
        reporting_period: { from: "2026-07-20", to: "2026-07-25" },
      },
      currentMaterialIds,
      manager,
      "2026-07-25T03:00:00.000Z",
    );
    const secondApproved = approveWeeklyReport(
      secondDraft,
      "report-cobalt-2026-w30",
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-25T03:03:00.000Z",
    );
    expect(() => sendWeeklyReport(
      secondApproved,
      "report-cobalt-2026-w30",
      "report-send-key",
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-25T03:04:00.000Z",
    )).toThrow(/another weekly report/);
  });

  it("marks an unsent report stale on material or recipient configuration drift", () => {
    const approved = approveWeeklyReport(
      drafted(),
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:03:00.000Z",
    );
    expect(markWeeklyReportStale(
      approved,
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:04:00.000Z",
      {
        current_sources: [...draftInput.sources].reverse(),
        current_recipients: { ...recipients, cc: [...recipients.cc].reverse() },
      },
    )).toBe(approved);
    const stale = markWeeklyReportStale(
      approved,
      draftInput.id,
      new Set(["activity-1", "outlook-1", "area-v3", "plan-v3"]),
      "recipient-config-v2",
      manager,
      "2026-07-18T03:05:00.000Z",
    );
    expect(stale.reports[0]?.status).toBe("stale");
    expect(stale.reports[0]?.approval.approved_by).toBe("usr-manager");
    expect(stale.audit.at(-1)).toMatchObject({
      event_type: "report.marked_stale",
      metadata: {
        material_drift: true,
        recipient_drift: true,
        recipient_configuration_drift: true,
        recipient_content_drift: false,
        source_content_drift: false,
      },
    });
    expect(() => sendWeeklyReport(
      stale,
      draftInput.id,
      "stale-send",
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:06:00.000Z",
    )).toThrow(/approval/);
  });

  it("marks a draft stale when canonical source content changes under the same source IDs", () => {
    const draft = drafted();
    const stale = markWeeklyReportStale(
      draft,
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:04:00.000Z",
      {
        current_sources: draftInput.sources.map((source) => source.id === "outlook-1"
          ? { ...source, summary: "Tampered summary under the same source ID." }
          : source),
        current_recipients: recipients,
      },
    );
    expect(stale.reports[0]?.status).toBe("stale");
    expect(stale.audit.at(-1)).toMatchObject({
      event_type: "report.marked_stale",
      metadata: {
        material_drift: false,
        recipient_configuration_drift: false,
        recipient_content_drift: false,
        source_content_drift: true,
      },
    });
  });

  it("marks an approved report stale when recipient content changes under the same config ID", () => {
    const approved = approveWeeklyReport(
      drafted(),
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:03:00.000Z",
    );
    const stale = markWeeklyReportStale(
      approved,
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:04:00.000Z",
      {
        current_sources: draftInput.sources,
        current_recipients: {
          ...recipients,
          to: [{ ...recipients.to[0]!, email: "changed.manager@example.test" }],
        },
      },
    );
    expect(stale.reports[0]?.status).toBe("stale");
    expect(stale.audit.at(-1)).toMatchObject({
      event_type: "report.marked_stale",
      metadata: {
        material_drift: false,
        recipient_configuration_drift: false,
        recipient_content_drift: true,
        source_content_drift: false,
      },
    });
  });

  it("keeps a sent report immutable even when canonical source and recipient content drift", () => {
    const approved = approveWeeklyReport(
      drafted(),
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:03:00.000Z",
    );
    const sent = sendWeeklyReport(
      approved,
      draftInput.id,
      "immutable-send",
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:04:00.000Z",
    );
    expect(markWeeklyReportStale(
      sent,
      draftInput.id,
      currentMaterialIds,
      recipients.configuration_id,
      manager,
      "2026-07-18T03:05:00.000Z",
      {
        current_sources: draftInput.sources.map((source) => ({ ...source, summary: "changed" })),
        current_recipients: {
          ...recipients,
          cc: recipients.cc.map((recipient) => ({ ...recipient, email: `changed.${recipient.email}` })),
        },
      },
    )).toBe(sent);
  });
});

describe("mobile request-to-package state machine", () => {
  const manager = { id: "manager", role: "lm_manager" as const };
  const extraction = {
    language: "ko" as const,
    building_mentions: [{ text: "Cobalt", resolved_building_id: "bld-cobalt", confidence: 0.99 }],
    floor: "5F", requested_fields: ["marketed_area", "rent_free", "supported_parking"] as const,
    requested_files: ["current_floor_plan"] as const,
    recipient: { name: "Alex", organization: "Northbridge" }, deadline: "today afternoon", ambiguities: [],
  };
  const material = {
    building_id: "bld-cobalt", building_name: "Cobalt Finance Center", floor: "5F",
    facts: [
      { field: "marketed_area" as const, label: "Marketed area", value: 200, unit: "py" as const, version_id: "area-v2", source_pointer: "published availability" },
      { field: "rent_free" as const, label: "Rent-free", value: 2, unit: "months" as const, version_id: "rf-v2", source_pointer: "published terms" },
      { field: "supported_parking" as const, label: "Supported parking", value: 2, unit: "spaces" as const, version_id: "park-v2", source_pointer: "published terms" },
    ],
    files: [{ requested_file: "current_floor_plan" as const, filename: "plan-v2.svg", version_id: "plan-v2", source_pointer: "published files" }],
  };

  function drafted() {
    const imported = importOperationalRequest(createInitialOperationalState(), {
      id: "req-1", source: "call", source_id: "call-1", raw_text: "request", extraction: { ...extraction, requested_fields: [...extraction.requested_fields], requested_files: [...extraction.requested_files] },
    }, manager, "2026-07-18T01:00:00.000Z");
    const confirmed = confirmOperationalRequest(imported, "req-1", manager, "2026-07-18T01:01:00.000Z");
    return draftOperationalPackage(confirmed, "req-1", material, {
      to: ["configured@example.test"], cc: ["manager@example.test"], configuration_id: "config-1",
    }, manager, "2026-07-18T01:02:00.000Z");
  }

  it("blocks ambiguous confirmation and non-manager approval", () => {
    const imported = importOperationalRequest(createInitialOperationalState(), {
      id: "req-ambiguous", source: "email", source_id: "email-1", raw_text: "which building", extraction: {
        ...extraction, requested_fields: [...extraction.requested_fields], requested_files: [...extraction.requested_files],
        ambiguities: [{ field: "building", reason: "not resolved" }],
      },
    }, manager, "2026-07-18T01:00:00.000Z");
    expect(() => confirmOperationalRequest(imported, "req-ambiguous", manager, "2026-07-18T01:01:00.000Z")).toThrow(/ambiguities/);
    expect(() => approveOperationalPackage(drafted(), "pkg-req-1", { id: "member", role: "lm_member" }, "2026-07-18T01:03:00.000Z")).toThrow(/not allowed/);
  });

  it("protects package facts/files/recipients during subject-body edit", () => {
    const before = drafted();
    const pkg = before.packages[0]!;
    const courteous = renderOperationalPackageBody(pkg.facts, pkg.files, "concise_courteous");
    const proposed = proposePackageEdit(before, "pkg-req-1", { subject: pkg.subject, body: courteous, instruction: "make concise" }, manager, "2026-07-18T01:03:00.000Z");
    const accepted = decidePackageEdit(proposed, "pkg-req-1", "accept", manager, "2026-07-18T01:04:00.000Z");
    expect(accepted.packages[0]).toMatchObject({ subject: pkg.subject, body: courteous });
    expect(accepted.packages[0]?.facts).toEqual(before.packages[0]?.facts);
    expect(accepted.packages[0]?.files).toEqual(before.packages[0]?.files);
    expect(accepted.packages[0]?.recipients).toEqual(before.packages[0]?.recipients);
    for (const malicious of [courteous.replace("200 py", "300 py"), courteous.replace(/^Attachment:.*$/m, ""), `${courteous}\nInvented term: 12 months`]) {
      expect(() => proposePackageEdit(before, "pkg-req-1", { subject: pkg.subject, body: malicious, instruction: "attack" }, manager, "2026-07-18T01:03:00.000Z")).toThrow(/protected|alter/);
      expect(before.packages[0]).toEqual(pkg);
    }
  });

  it("requires approval and current versions, then sends exactly once", () => {
    const draft = drafted();
    const current = new Set(["area-v2", "rf-v2", "park-v2", "plan-v2"]);
    expect(() => sendOperationalPackage(draft, "pkg-req-1", "send-key-1", current, manager, "2026-07-18T01:04:00.000Z")).toThrow(/approval/);
    const approved = approveOperationalPackage(draft, "pkg-req-1", manager, "2026-07-18T01:04:00.000Z");
    expect(() => sendOperationalPackage(approved, "pkg-req-1", "send-key-1", new Set(["area-v1"]), manager, "2026-07-18T01:05:00.000Z")).toThrow(/stale/);
    const sent = sendOperationalPackage(approved, "pkg-req-1", "send-key-1", current, manager, "2026-07-18T01:05:00.000Z");
    expect(sent.activities).toHaveLength(1);
    expect(sendOperationalPackage(sent, "pkg-req-1", "send-key-1", current, manager, "2026-07-18T01:06:00.000Z")).toBe(sent);

    const second = { ...approved, packages: [...approved.packages, { ...approved.packages[0]!, id: "pkg-req-2", request_id: "req-2" }] };
    const firstSent = sendOperationalPackage(second, "pkg-req-1", "global-key", current, manager, "2026-07-18T01:07:00.000Z");
    expect(() => sendOperationalPackage(firstSent, "pkg-req-2", "global-key", current, manager, "2026-07-18T01:08:00.000Z")).toThrow(/another package/);
  });
});

interface TestRecord extends VersionedRecord {
  floor: string;
  field: "marketed_area_py" | "rent_free_months" | "supported_parking_spaces";
  value: number;
}

interface TestFile extends FileVersion {
  file_type: "floor_plan";
}

function workflowState(): GovernedPublicationState<TestRecord, TestFile> {
  return {
    revision: 0,
    effective_date: "2026-07-18",
    publication_scope: { building_id: "b1", floor: "5F" },
    stage: "source_uploaded",
    candidates: [],
    records: [
      {id:"area-v1",building_id:"b1",floor:"5F",field:"marketed_area_py",value:300,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"area-v2",building_id:"b1",floor:"5F",field:"marketed_area_py",value:200,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"rf-v1",building_id:"b1",floor:"5F",field:"rent_free_months",value:3,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"rf-v2",building_id:"b1",floor:"5F",field:"rent_free_months",value:2,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"park-v1",building_id:"b1",floor:"5F",field:"supported_parking_spaces",value:3,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"park-v2",building_id:"b1",floor:"5F",field:"supported_parking_spaces",value:2,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-area-v1",building_id:"b2",floor:"5F",field:"marketed_area_py",value:900,version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-area-v2",building_id:"b2",floor:"5F",field:"marketed_area_py",value:800,version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
    ],
    files: [
      {id:"plan-v1",building_id:"b1",floor:"5F",filename:"plan-v1.svg",file_type:"floor_plan",version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"plan-v2",building_id:"b1",floor:"5F",filename:"plan-v2.svg",file_type:"floor_plan",version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-plan-v1",building_id:"b2",floor:"5F",filename:"other-plan-v1.svg",file_type:"floor_plan",version_no:1,status:"published",valid_from:"2026-06-01",valid_to:null,superseded:false,external_shareable:true},
      {id:"other-plan-v2",building_id:"b2",floor:"5F",filename:"other-plan-v2.svg",file_type:"floor_plan",version_no:2,status:"candidate",valid_from:"2026-07-18",valid_to:null,superseded:false,external_shareable:true},
    ],
    audit: [],
  };
}

function publicationCandidate(
  input: Omit<CandidateChange, "source_state" | "source_pointer" | "confidence" | "external_shareable_candidate" | "status">,
): CandidateChange {
  return {
    ...input,
    source_state: "confirmed",
    source_pointer: "source / 5F",
    confidence: 0.99,
    external_shareable_candidate: true,
    status: "candidate",
  };
}

const candidates: CandidateChange[] = [
  publicationCandidate({id:"c-area",building_id:"b1",field:"marketed_area_py",floor:"5F",target_type:"record",predecessor_version_id:"area-v1",candidate_version_id:"area-v2",previous_value:300,proposed_value:200}),
  publicationCandidate({id:"c-plan",building_id:"b1",field:"floor_plan",floor:"5F",target_type:"file",predecessor_version_id:"plan-v1",candidate_version_id:"plan-v2",previous_value:"plan-v1.svg",proposed_value:"plan-v2.svg"}),
  publicationCandidate({id:"c-rf",building_id:"b1",field:"rent_free_months",floor:"5F",target_type:"record",predecessor_version_id:"rf-v1",candidate_version_id:"rf-v2",previous_value:3,proposed_value:2}),
  publicationCandidate({id:"c-park",building_id:"b1",field:"supported_parking_spaces",floor:"5F",target_type:"record",predecessor_version_id:"park-v1",candidate_version_id:"park-v2",previous_value:3,proposed_value:2}),
];

describe("publication state machine", () => {
  it("allows only legal consecutive transitions", () => {
    expect(() => assertTransition("source_uploaded", "extracted_candidate")).not.toThrow();
    expect(() => assertTransition("source_uploaded", "published")).toThrow(/Illegal publication transition/);
    expect(() => assertTransition("published", "junior_confirmed")).toThrow(/Illegal publication transition/);
  });

  it("does not mutate state when a junior attempts publication", () => {
    const extracted = recordExtraction(workflowState(), candidates, {id:"junior",role:"data_steward"}, "2026-07-18T09:00:00.000Z");
    const confirmed = confirmCandidates(extracted, {id:"junior",role:"data_steward"}, "2026-07-18T09:01:00.000Z");
    const before = structuredClone(confirmed);
    expect(() => publishConfirmedBatch(confirmed, {id:"junior",role:"data_steward"}, "2026-07-18T09:02:00.000Z")).toThrow(/not allowed/);
    expect(confirmed).toEqual(before);
  });

  it("publishes only the four targeted versions and leaves another building untouched", () => {
    const extracted = recordExtraction(workflowState(), candidates, {id:"junior",role:"data_steward"}, "2026-07-18T09:00:00.000Z");
    const confirmed = confirmCandidates(extracted, {id:"junior",role:"data_steward"}, "2026-07-18T09:01:00.000Z");
    const unrelatedRecords = confirmed.records.filter((record) => record.building_id === "b2");
    const unrelatedFiles = confirmed.files.filter((file) => file.building_id === "b2");
    const published = publishConfirmedBatch(confirmed, {id:"senior",role:"senior_reviewer"}, "2026-07-18T09:02:00.000Z");
    expect(published.stage).toBe("published");
    expect(published.revision).toBe(3);
    expect(published.records.filter((record) => record.building_id === "b1" && record.version_no === 1)
      .every((record) => record.status === "superseded" && record.superseded && record.valid_to === "2026-07-17")).toBe(true);
    expect(published.records.filter((record) => record.building_id === "b1" && record.version_no === 2)
      .every((record) => record.status === "published" && !record.superseded)).toBe(true);
    expect(published.records.filter((record) => record.building_id === "b2")).toEqual(unrelatedRecords);
    expect(published.files.filter((file) => file.building_id === "b2")).toEqual(unrelatedFiles);
    expect(published.audit.map((event) => event.event_type)).toEqual([
      "source.extracted", "candidate.confirmed", "batch.senior_approved", "batch.published",
    ]);
  });

  it("rejects incomplete, mismatched, or non-shareable publication candidates", () => {
    const extracted = recordExtraction(workflowState(), candidates, {id:"junior",role:"data_steward"}, "2026-07-18T09:00:00.000Z");
    const confirmed = confirmCandidates(extracted, {id:"junior",role:"data_steward"}, "2026-07-18T09:01:00.000Z");
    expect(() => publishConfirmedBatch(
      { ...confirmed, candidates: confirmed.candidates.slice(0, 3) },
      {id:"senior",role:"senior_reviewer"},
      "2026-07-18T09:02:00.000Z",
    )).toThrow(/exactly 4/);
    expect(() => publishConfirmedBatch(
      { ...confirmed, candidates: confirmed.candidates.map((candidate) => candidate.field === "marketed_area_py" ? { ...candidate, proposed_value: 999 } : candidate) },
      {id:"senior",role:"senior_reviewer"},
      "2026-07-18T09:02:00.000Z",
    )).toThrow(/proposed value/);
    expect(() => publishConfirmedBatch(
      { ...confirmed, candidates: confirmed.candidates.map((candidate) => candidate.field === "floor_plan" ? { ...candidate, external_shareable_candidate: false } : candidate) },
      {id:"senior",role:"senior_reviewer"},
      "2026-07-18T09:02:00.000Z",
    )).toThrow(/not confirmed and shareable/);
  });
});
