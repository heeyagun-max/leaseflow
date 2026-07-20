import {
  createMobilePublishedSnapshot,
  createPublicOperationsSnapshot,
  demoUsers,
  type PublicOperationsSnapshot,
} from "@leaseflow/demo-data";
import { selectPublishedDocumentReferences } from "@leaseflow/domain";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod/v3";
import { getDemoStore, loadDemoRuntimeConfiguration, type DemoFileStore, type DemoRuntimeConfiguration } from "./demo-store.server";
import { toPublicWorkflow, type PublicWorkflow } from "./mobile-workflow-public.server";
import { toPublicReportWorkflow, type PublicReportWorkflow } from "./report-workflow-public.server";
import { demoDataDirectory } from "./weekly-settings-config.server";

export interface PublicBuildingSummary {
  building_id: string;
  building_name: string;
  search_aliases: string[];
  landlord_name: string;
  market: string;
  latest_changed_at: string;
  available_floors: string[];
  marketed_area_py: number;
  availability: string;
}

export type OperationsSnapshotPublic = PublicOperationsSnapshot<PublicWorkflow, PublicReportWorkflow> & {
  buildings: PublicBuildingSummary[];
};

const buildingPortfolioSchema = z.array(z.object({
  building_id: z.string().min(1),
  building_name: z.string().min(1),
  search_aliases: z.array(z.string().min(1)),
  landlord_name: z.string().min(1),
  market: z.string().min(1),
  latest_changed_at: z.string().datetime({ offset: true }),
  available_floors: z.array(z.string().min(1)).min(1),
  marketed_area_py: z.number().positive(),
  availability: z.string().min(1),
  status: z.literal("published"),
  active: z.literal(true),
  external_shareable: z.literal(true),
}).strict());

type BuildingPortfolioRecord = z.infer<typeof buildingPortfolioSchema>[number];

async function loadBuildingPortfolio(): Promise<BuildingPortfolioRecord[]> {
  const raw = await readFile(path.join(demoDataDirectory(), "building_portfolio.json"), "utf8");
  return buildingPortfolioSchema.parse(JSON.parse(raw));
}

export async function loadOperationsSnapshotPublic(
  actorId: string,
  store: Pick<DemoFileStore, "getState"> = getDemoStore(),
  configurationLoader: () => Promise<Pick<DemoRuntimeConfiguration, "access">> = loadDemoRuntimeConfiguration,
): Promise<OperationsSnapshotPublic> {
  const actor = demoUsers.find((candidate) => candidate.id === actorId);
  if (!actor) throw new Error(`Unknown demo actor: ${actorId}.`);

  const [state, configuration, portfolio] = await Promise.all([
    store.getState(),
    configurationLoader(),
    loadBuildingPortfolio(),
  ]);
  const authorizedBuildingIds = configuration.access.users
    .find((entry) => entry.user_id === actor.id)?.building_ids ?? [];
  if (!authorizedBuildingIds.includes(state.publication_scope.building_id)) {
    throw new Error(`Demo user ${actor.id} is not authorized for building ${state.publication_scope.building_id}.`);
  }

  const published = createMobilePublishedSnapshot(state);
  const workflow = toPublicWorkflow(state);
  const reports = toPublicReportWorkflow(state, actor.id, authorizedBuildingIds);
  const allowedBuildings = new Set(authorizedBuildingIds);

  if (workflow.requests.some((request) => {
    const buildingId = request.summary.building_id;
    return buildingId !== null && !allowedBuildings.has(buildingId);
  }) || workflow.packages.some((pkg) => !allowedBuildings.has(pkg.building_id))
    || workflow.activities.some((activity) => !allowedBuildings.has(activity.building_id))
    || reports.reports.some((report) => !allowedBuildings.has(report.building_id))
    || reports.activities.some((activity) => !allowedBuildings.has(activity.building_id))) {
    throw new Error("Operations snapshot is blocked by state outside the actor's authorized building scope.");
  }

  const snapshot = createPublicOperationsSnapshot({
    authorized_building_ids: authorizedBuildingIds,
    published,
    published_documents: selectPublishedDocumentReferences(
      state.asset_registry.assets,
      authorizedBuildingIds,
    ),
    workflow,
    reports,
  });
  const buildings = portfolio
    .filter((building) => allowedBuildings.has(building.building_id))
    .map(({ status: _status, active: _active, external_shareable: _externalShareable, ...building }) => (
      building.building_id === published.building_id
        ? {
            ...building,
            available_floors: [published.floor],
            marketed_area_py: published.marketed_area_py,
          }
        : building
    ));
  if (buildings.length !== authorizedBuildingIds.length) {
    throw new Error("Operations snapshot is missing a published building summary in the actor's authorized scope.");
  }
  return { ...snapshot, buildings };
}
