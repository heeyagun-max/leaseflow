import { NextResponse } from "next/server";
import { z } from "zod/v3";
import { mutationError } from "@/lib/api-response";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { getDemoStore } from "@/lib/demo-store.server";

export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"), actor_id: z.string().min(1), expected_revision: z.number().int().nonnegative(),
    asset_id: z.string().min(1), building_id: z.string().min(1), externally_shareable: z.boolean(),
  }).strict(),
  z.object({
    action: z.literal("publish"), actor_id: z.string().min(1), expected_revision: z.number().int().nonnegative(),
    asset_id: z.string().min(1),
  }).strict(),
]);

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const input = requestSchema.parse(await request.json());
    const state = input.action === "confirm"
      ? await getDemoStore().confirmAsset(input)
      : await getDemoStore().publishAsset(input);
    return NextResponse.json({ state });
  } catch (error) {
    return mutationError(error);
  }
}
