import { NextResponse } from "next/server";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { loadDemoWorkflowProjection } from "@/lib/demo-workflow-public.server";
import { mutationError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertDemoMode();
    const actorId = new URL(request.url).searchParams.get("actor_id");
    if (!actorId) throw new Error("Unknown demo actor: missing actor_id.");
    return NextResponse.json(await loadDemoWorkflowProjection(undefined, undefined, actorId));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown demo actor:")) {
      return NextResponse.json({ error: "요청한 역할 정보를 확인할 수 없습니다." }, { status: 400 });
    }
    return mutationError(error);
  }
}
