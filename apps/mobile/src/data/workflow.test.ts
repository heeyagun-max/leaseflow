import { describe, expect, it, vi } from "vitest";
import { fetchMobileWorkflow, mutateMobileWorkflow } from "./workflow";

const view = { revision: 7, publication_stage: "published", requests: [], packages: [], activities: [], audit: [], labels: { mode: "DEMO", role: "LM Manager", delivery: "SANDBOX ONLY" } } as const;
const snapshot = { snapshot_version: 1, revision: 7, publication_stage: "published", scope: { building_ids: ["bld-cobalt"] },
  published: { revision: 7, publication_stage: "published", building_id: "bld-cobalt" }, workflow: view,
  reports: { revision: 7, publication_stage: "published", reports: [], activities: [], audit: [] } };

describe("mobile workflow HTTP adapter", () => {
  it("loads the curated response from the configured base URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 }));
    await expect(fetchMobileWorkflow({ baseUrl: "https://demo.example/", fetcher })).resolves.toEqual(view);
    expect(fetcher).toHaveBeenCalledWith("https://demo.example/api/operations/snapshot?actor_id=usr-manager", { headers: { Accept: "application/json" } });
  });

  it("sends the LM Manager actor and expected revision", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(view), { status: 200 }));
    await mutateMobileWorkflow(7, { action: "approve", package_id: "pkg-1" }, { baseUrl: "https://demo.example", fetcher });
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({ action: "approve", package_id: "pkg-1", actor_id: "usr-manager", expected_revision: 7 });
  });

  it("surfaces structured server errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Revision conflict" }), { status: 409 }));
    await expect(fetchMobileWorkflow({ fetcher })).rejects.toThrow("Revision conflict");
  });
});
