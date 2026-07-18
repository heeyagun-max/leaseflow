import { describe, expect, it, vi } from "vitest";
import { SourceCandidateSchema } from "@leaseflow/ai";
import { demoExtractionResult } from "@leaseflow/demo-data";
import { extractSyntheticSource, type SourceExtractionAdapter } from "./source-extraction.server";

function sourceFixture() {
  return {
    id: "src-cobalt-jul",
    building_id: "bld-cobalt",
    title: "Cobalt Finance Center July Leasing Update",
    effective_date: "2026-07-18",
    source_type: "monthly_owner_update",
    content: {
      floor: "5F",
      previous_marketed_area_py: 300,
      current_marketed_area_py: 200,
      reason: "100 py occupied by another tenant",
      previous_rent_free_months: 3,
      current_rent_free_months: 2,
      previous_supported_parking_spaces: 3,
      current_supported_parking_spaces: 2,
      previous_plan: "CFC_5F_plan_v1.svg",
      current_plan: "CFC_5F_plan_v2.svg",
    },
  };
}

describe("server-only synthetic source extraction", () => {
  it("invokes the injectable structured adapter in live configuration without network", async () => {
    const adapter = vi.fn<SourceExtractionAdapter>(async () => structuredClone(demoExtractionResult));
    const result = await extractSyntheticSource({
      adapter,
      environment: {
        DEMO_MODE: "true",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "gpt-5.6-test",
      },
      loadSource: async () => sourceFixture(),
    });

    expect(result.mode).toBe("live");
    expect(result.candidates.changes).toHaveLength(4);
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      schema: SourceCandidateSchema,
      schemaName: "leaseflow_source_candidate",
      model: "gpt-5.6-test",
    }));
    expect(JSON.parse(adapter.mock.calls[0]![0].user)).toMatchObject({ id: "src-cobalt-jul" });
  });

  it("uses fixture output only for explicit credential-free demo mode", async () => {
    const adapter = vi.fn<SourceExtractionAdapter>(async () => structuredClone(demoExtractionResult));
    const fallback = await extractSyntheticSource({
      adapter,
      environment: { DEMO_MODE: "true" },
      loadSource: async () => sourceFixture(),
    });
    expect(fallback.mode).toBe("credential_free_demo");
    expect(adapter).not.toHaveBeenCalled();

    const nonDemo = await extractSyntheticSource({
      adapter,
      environment: { DEMO_MODE: "false" },
      loadSource: async () => sourceFixture(),
    });
    expect(nonDemo.mode).toBe("live");
    expect(adapter).toHaveBeenCalledOnce();
  });
});
