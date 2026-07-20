import path from "node:path";
import { readFile } from "node:fs/promises";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { mutationError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function repositoryRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
}

export async function GET() {
  try {
    assertDemoMode();
    const bytes = await readFile(path.join(repositoryRoot(), "data/demo/source_update.json"));
    return new Response(bytes, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="LeaseFlow_Synthetic_Building_Update.json"',
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return mutationError(error);
  }
}
