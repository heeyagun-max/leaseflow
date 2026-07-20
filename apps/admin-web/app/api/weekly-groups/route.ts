import { NextResponse } from "next/server";
import { assertDemoMode, DemoModeDisabledError } from "@/lib/demo-mode.server";
import { WeeklySettingsAccessError, WeeklySettingsStore } from "@/lib/weekly-settings.server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers });
}

export async function GET(request: Request) {
  try {
    assertDemoMode();
    const actorId = new URL(request.url).searchParams.get("actor_id");
    if (!actorId) return json({ error: "현재 역할을 확인할 수 없습니다." }, 400);
    return json(await new WeeklySettingsStore().getOperationalGroups(actorId));
  } catch (error) {
    if (error instanceof DemoModeDisabledError) return json({ error: "합성 데모에서만 사용할 수 있습니다." }, 404);
    if (error instanceof WeeklySettingsAccessError) return json({ error: error.message }, 403);
    return json({ error: "주간 보고 구성을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
}
