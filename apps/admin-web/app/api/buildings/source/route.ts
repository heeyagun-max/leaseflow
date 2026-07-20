import { NextResponse } from "next/server";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { loadCurrentBuildingSourceFile } from "@/lib/current-building-source.server";

export const dynamic = "force-dynamic";

function attachmentName(filename: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request) {
  try {
    assertDemoMode();
    const url = new URL(request.url);
    const actorId = url.searchParams.get("actor_id");
    const buildingId = url.searchParams.get("building_id");
    if (!actorId || !buildingId) throw new Error("원본 자료 요청 정보를 확인해 주세요.");
    const source = await loadCurrentBuildingSourceFile(actorId, buildingId);
    return new NextResponse(Uint8Array.from(source.bytes).buffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": attachmentName(source.filename),
        "Content-Type": source.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "원본 자료를 열 수 없습니다.";
    return NextResponse.json({ error: message }, { status: 410, headers: { "Cache-Control": "no-store" } });
  }
}
