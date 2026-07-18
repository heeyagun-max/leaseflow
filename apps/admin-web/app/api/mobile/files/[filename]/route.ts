import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireCurrentPublishedDemoFile } from "@leaseflow/demo-data";
import { mutationError } from "@/lib/api-response";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { getDemoStore } from "@/lib/demo-store.server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  try {
    assertDemoMode();
  } catch (error) {
    return mutationError(error);
  }
  const { filename } = await context.params;
  try {
    const state = await getDemoStore().getState();
    const file = requireCurrentPublishedDemoFile(state, filename);
    const cwd = process.cwd();
    const root = path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
    const content = await readFile(path.join(root, "data/demo/assets", file.filename), "utf8");
    return new NextResponse(content, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Floor plan unavailable.";
    return NextResponse.json({ error: message }, { status: 410 });
  }
}
