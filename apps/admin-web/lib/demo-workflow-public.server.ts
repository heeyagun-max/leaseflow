import { demoSourceUpdate, demoUsers, demoWeeklyReportExpected } from "@leaseflow/demo-data";
import { selectCurrentPublished, type UserRole, type VersionedRecord } from "@leaseflow/domain";
import {
  getDemoStore,
  loadDemoRuntimeConfiguration,
  type DemoFileStore,
  type DemoRuntimeConfiguration,
} from "./demo-store.server";

export async function loadDemoWorkflowProjection(
  store: Pick<DemoFileStore, "getState"> = getDemoStore(),
  configurationLoader: () => Promise<Pick<DemoRuntimeConfiguration, "reportRecipients">> = loadDemoRuntimeConfiguration,
  actorId = "usr-manager",
  now = new Date(),
) {
  const [state, configuration] = await Promise.all([
    store.getState(),
    configurationLoader(),
  ]);
  const actor = demoUsers.find((user) => user.id === actorId);
  if (!actor) throw new Error(`Unknown demo actor: ${actorId}.`);
  const canViewSettings = canViewDemoSettings(actor.role);
  const reportRecipients = configuration.reportRecipients;
  if (!reportRecipients) throw new Error("No configured weekly-report recipient group is available.");
  const visibleState = state.stage === "source_uploaded"
    ? {
      ...state,
      records: state.records.filter((record) => record.status === "published"),
      files: state.files.filter((file) => file.status === "published"),
      asset_registry: {
        assets: state.asset_registry.assets.filter((asset) =>
          !asset.linked_file_version_id
          || state.files.some((file) => file.id === asset.linked_file_version_id && file.status === "published")),
      },
    }
    : state;
  const scopedState = canViewSettings ? visibleState : { ...visibleState, audit: [] };
  return {
    state: scopedState,
    canViewSettings,
    reviewBatchRef: state.source_id,
    currentOperations: selectCurrentExternalOperations(state, now),
    source: {
      id: demoSourceUpdate.id,
      buildingName: demoSourceUpdate.buildingName,
      effectiveDate: demoSourceUpdate.effectiveDate,
      title: "July leasing update",
    },
    users: demoUsers,
    reportConfiguration: canViewSettings ? {
      buildingId: reportRecipients.building_id,
      recipients: {
        to: reportRecipients.to,
        cc: reportRecipients.cc,
      },
      reportingPeriod: demoWeeklyReportExpected.reporting_period,
    } : null,
    storage: "Single-process DEMO_MODE JSON adapter; Supabase adapter planned.",
  };
}

export function canViewDemoSettings(role: UserRole) {
  return role === "lm_manager" || role === "admin";
}

export function seoulDateStamp(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function canonicalAsOf(now: Date) {
  return new Date(`${seoulDateStamp(now)}T00:00:00.000Z`);
}

function selectCurrentByKey<T extends VersionedRecord>(items: readonly T[], key: (item: T) => string, asOf: Date) {
  const keys = [...new Set(items.map(key))];
  return keys.flatMap((value) => {
    const selected = selectCurrentPublished(items.filter((item) => key(item) === value), asOf);
    return selected?.external_shareable ? [selected] : [];
  });
}

export function selectCurrentExternalOperations(
  state: Awaited<ReturnType<DemoFileStore["getState"]>>,
  now = new Date(),
) {
  const asOf = canonicalAsOf(now);
  return {
    records: selectCurrentByKey(state.records, (record) => `${record.building_id}:${record.floor}:${record.field}`, asOf),
    files: selectCurrentByKey(state.files, (file) => `${file.building_id}:${file.floor}:${file.file_type}`, asOf),
    asOf: seoulDateStamp(now),
  };
}
