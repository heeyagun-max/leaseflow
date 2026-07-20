import { describe, expect, it } from "vitest";
import { createInitialDemoState } from "@leaseflow/demo-data";
import { renderPublicPackageBody, toPublicWorkflow } from "./mobile-workflow-public.server";

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

  it("renders external-facing Korean package copy without protected implementation markers", () => {
    const body = renderPublicPackageBody(
      [
        { label: "Marketed area", value: 200, unit: "py" },
        { label: "Rent-free", value: 2, unit: "months" },
        { label: "Supported parking", value: 2, unit: "spaces" },
      ],
      [{ filename: "CFC_5F_plan_v2.svg" }],
    );
    expect(body).toContain("임대 가능 면적: 200평");
    expect(body).toContain("렌트프리: 2개월");
    expect(body).toContain("지원 주차: 2대");
    expect(body).toContain("첨부 자료: CFC_5F_plan_v2.svg");
    expect(body).not.toMatch(/PROTECTED|version=|source=|Current published/i);
    expect(renderPublicPackageBody(
      [{ label: "Marketed area", value: 200, unit: "py" }],
      [],
      "concise_courteous",
    )).not.toBe(body);
  });
});
