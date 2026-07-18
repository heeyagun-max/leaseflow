import { describe, expect, it, vi } from "vitest";
import { resetDemo } from "./demo-reset";

describe("demo reset HTTP adapter", () => {
  it("posts the manager actor and current revision to the configured reset endpoint", async () => {
    const response = { state: { revision: 13 } };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    await expect(resetDemo(12, { baseUrl: "https://demo.example/", fetcher })).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith("https://demo.example/api/demo/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ actor_id: "usr-manager", expected_revision: 12 }),
    });
  });

  it("uses the local admin URL by default", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: { revision: 1 } }), { status: 200 }));

    await resetDemo(0, { fetcher });

    expect(fetcher.mock.calls[0]?.[0]).toBe("http://localhost:3000/api/demo/reset");
  });

  it("surfaces the server error message", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Revision conflict" }), { status: 409 }));

    await expect(resetDemo(7, { fetcher })).rejects.toThrow("Revision conflict");
  });
});
