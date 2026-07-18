import { NextResponse } from "next/server";
import { DemoModeDisabledError } from "./demo-mode.server";
import { RevisionConflictError } from "./demo-store.server";

export function mutationError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown demo workflow error.";
  if (error instanceof DemoModeDisabledError) {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  if (error instanceof RevisionConflictError) {
    return NextResponse.json({ error: message, current_revision: error.actual }, { status: 409 });
  }
  if (message.includes("not allowed")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message.includes("Illegal publication transition")
    || message.includes("Publication requires")
    || message.includes("Candidate ")) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function parseMutationRequest(request: Request): Promise<{
  actor_id: string;
  expected_revision: number;
}> {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object") throw new Error("A JSON request body is required.");
  const input = body as Record<string, unknown>;
  if (typeof input.actor_id !== "string") throw new Error("actor_id is required.");
  if (!Number.isInteger(input.expected_revision)) throw new Error("expected_revision must be an integer.");
  return { actor_id: input.actor_id, expected_revision: input.expected_revision as number };
}
