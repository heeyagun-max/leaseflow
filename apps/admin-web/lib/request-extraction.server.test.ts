import { describe, expect, it, vi } from "vitest";
import { RequestSchema } from "@leaseflow/ai";
import { demoRequestExtraction, extractSyntheticRequest, loadSyntheticRequestFixture } from "./request-extraction.server";

describe("request extraction service", () => {
  it("uses strict canonical request fields and rejects unknown keys/enums", () => {
    expect(RequestSchema.parse(demoRequestExtraction("call")).requested_fields).toEqual([
      "marketed_area", "rent_free", "supported_parking",
    ]);
    expect(() => RequestSchema.parse({ ...demoRequestExtraction("call"), invented: true })).toThrow();
    expect(() => RequestSchema.parse({ ...demoRequestExtraction("call"), requested_fields: ["asking_rent"] })).toThrow();
    expect(() => RequestSchema.parse({
      ...demoRequestExtraction("call"),
      recipient: { ...demoRequestExtraction("call").recipient, invented_email: "model@example.test" },
    })).toThrow();
  });

  it("loads both synthetic call and email fixtures", async () => {
    await expect(loadSyntheticRequestFixture("call")).resolves.toMatchObject({ source: "call", id: "activity-call-cobalt" });
    await expect(loadSyntheticRequestFixture("email")).resolves.toMatchObject({ source: "email", id: "email-request-cobalt-5f" });
  });

  it("uses credential-free fallback only in explicit demo mode", async () => {
    const adapter = vi.fn();
    const result = await extractSyntheticRequest("call", { environment: { DEMO_MODE: "true" }, adapter });
    expect(result.mode).toBe("credential_free_demo");
    expect(adapter).not.toHaveBeenCalled();
  });

  it("revalidates injectable live adapter output", async () => {
    const valid = demoRequestExtraction("email");
    const live = await extractSyntheticRequest("email", {
      environment: { DEMO_MODE: "false", OPENAI_API_KEY: "synthetic-test-key", OPENAI_MODEL: "test-model" },
      adapter: vi.fn().mockResolvedValue(valid),
    });
    expect(live).toMatchObject({ mode: "live", extraction: valid });
    await expect(extractSyntheticRequest("email", {
      environment: { DEMO_MODE: "false", OPENAI_API_KEY: "synthetic-test-key" },
      adapter: vi.fn().mockResolvedValue({ ...valid, requested_files: ["invented_file"] }),
    })).rejects.toThrow();
  });

  it("never sends call fixture expected_task ground truth to the adapter", async () => {
    const adapter = vi.fn().mockResolvedValue(demoRequestExtraction("call"));
    await extractSyntheticRequest("call", {
      environment: { DEMO_MODE: "false", OPENAI_API_KEY: "synthetic-test-key", OPENAI_MODEL: "test" }, adapter,
    });
    const user = adapter.mock.calls[0]?.[0].user as string;
    expect(user).not.toContain("expected_task");
    expect(JSON.parse(user)).toEqual(expect.objectContaining({ channel: "call_transcript", contact: "Alex Chen", organization: "Northbridge Advisory" }));
  });
});
