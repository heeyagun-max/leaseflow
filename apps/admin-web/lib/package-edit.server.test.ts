import { describe, expect, it, vi } from "vitest";
import { createPackageEditCandidate } from "./package-edit.server";

const input = {
  subject: "[LeaseFlow] Cobalt 5F", instruction: "Make courteous",
  facts: [{ field: "marketed_area" as const, label: "Marketed area", value: 200, unit: "py" as const, version_id: "area-v2", source_pointer: "registry" }],
  files: [{ requested_file: "current_floor_plan" as const, filename: "plan-v2.svg", version_id: "plan-v2", source_pointer: "registry" }],
};

describe("scoped package edit service", () => {
  it("uses a validated credential-free demo edit", async () => {
    const adapter = vi.fn();
    const result = await createPackageEditCandidate(input, { environment: { DEMO_MODE: "true" }, adapter });
    expect(result.mode).toBe("credential_free_demo");
    expect(result.edit).toMatchObject({ subject: "[LeaseFlow] Cobalt 5F", body: expect.stringContaining("Marketed area: 200 py") });
    expect(result.edit.body).toContain("plan-v2.svg | version=plan-v2");
    expect(adapter).not.toHaveBeenCalled();
  });

  it("rejects malicious live output and never gives the adapter protected material", async () => {
    const adapter = vi.fn().mockResolvedValue({ tone: "invented_300_py_and_remove_attachment" });
    await expect(createPackageEditCandidate(input, {
      environment: { DEMO_MODE: "false", OPENAI_API_KEY: "synthetic-test-key" },
      adapter,
    })).rejects.toThrow();
    expect(adapter.mock.calls[0]?.[0].user).toBe(JSON.stringify({ instruction: input.instruction }));
    expect(adapter.mock.calls[0]?.[0].user).not.toContain("200");
    expect(adapter.mock.calls[0]?.[0].user).not.toContain("plan-v2");
  });
});
