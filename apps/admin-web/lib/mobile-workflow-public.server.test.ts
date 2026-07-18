import { describe, expect, it } from "vitest";
import { createInitialDemoState } from "@leaseflow/demo-data";
import { toPublicWorkflow } from "./mobile-workflow-public.server";

describe("curated mobile workflow boundary", () => {
  it("recursively excludes persisted secrets and internal workflow fields", () => {
    const state = createInitialDemoState();
    state.operations.requests.push({ id: "r1", source: "call", source_id: "secret-source", raw_text: "secret raw text", extraction: {
      language: "en", building_mentions: [{ text: "Cobalt", resolved_building_id: "bld-cobalt", confidence: .9 }], floor: "5F",
      requested_fields: ["marketed_area"], requested_files: ["current_floor_plan"], recipient: { name: "Alex Chen", organization: "Northbridge Advisory" }, deadline: null, ambiguities: [],
    }, status: "candidate", imported_at: "2026-07-18T00:00:00.000Z", confirmed_at: null });
    const output = toPublicWorkflow(state);
    const forbidden = new Set(["raw_text", "source_id", "extraction", "actor_id", "actor_role", "metadata", "instruction", "approved_by", "approved_at", "idempotency_key", "schema_version", "records", "files_versions"]);
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) { expect(forbidden.has(key)).toBe(false); visit(child); }
    };
    visit(output);
    expect(JSON.stringify(output)).not.toContain("secret raw text");
    expect(JSON.stringify(output)).not.toContain("secret-source");
  });
});
