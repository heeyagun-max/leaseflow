import { createBuildingUpdateHandlers } from "@/lib/building-updates-route.server";
import { getBuildingUpdateService } from "@/lib/building-updates.server";

export const dynamic = "force-dynamic";
const handlers = createBuildingUpdateHandlers(getBuildingUpdateService());
export const GET = handlers.get;
export const POST = handlers.post;
