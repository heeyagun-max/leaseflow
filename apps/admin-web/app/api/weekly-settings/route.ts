import { NextResponse } from "next/server";
import { ZodError } from "zod/v3";
import { assertDemoMode, DemoModeDisabledError } from "@/lib/demo-mode.server";
import {
  WeeklySettingsAccessError,
  WeeklySettingsNotFoundError,
  WeeklySettingsRevisionError,
  WeeklySettingsStore,
  WeeklySettingsValidationError,
} from "@/lib/weekly-settings.server";
import {
  weeklySettingsMutationSchema,
  weeklySettingsUpdateSchema,
} from "@/lib/weekly-settings-schema";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers });
}

function apiError(error: unknown) {
  if (error instanceof WeeklySettingsAccessError) return json({ error: error.message }, 403);
  if (error instanceof WeeklySettingsNotFoundError) return json({ error: error.message }, 404);
  if (error instanceof WeeklySettingsRevisionError) {
    return json({ error: error.message, current_revision: error.currentRevision }, 409);
  }
  if (error instanceof WeeklySettingsValidationError) return json({ error: error.message }, 400);
  if (error instanceof ZodError) return json({ error: "입력한 내용을 다시 확인해 주세요." }, 400);
  if (error instanceof DemoModeDisabledError) return json({ error: "합성 데모에서만 사용할 수 있습니다." }, 404);
  return json({ error: "설정을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
}

export async function GET(request: Request) {
  try {
    assertDemoMode();
    const params = new URL(request.url).searchParams;
    const actorId = params.get("actor_id");
    if (!actorId) return json({ error: "현재 역할을 확인할 수 없습니다." }, 400);
    return json(await new WeeklySettingsStore().get(actorId, params.get("group_ref") ?? undefined));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const input = weeklySettingsMutationSchema.parse(await request.json());
    return json(await new WeeklySettingsStore().create(input.actor_id, input.expected_revision, input.group), 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertDemoMode();
    const input = weeklySettingsUpdateSchema.parse(await request.json());
    return json(await new WeeklySettingsStore().update(input.actor_id, input.expected_revision, input.group_ref, input.group));
  } catch (error) {
    return apiError(error);
  }
}
