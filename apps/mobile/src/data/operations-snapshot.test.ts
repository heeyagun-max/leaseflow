import { describe, expect, it, vi } from "vitest";
import { fetchOperationsSnapshot } from "./operations-snapshot";

function snapshot(revision = 4) {
  return {
    snapshot_version: 1, revision, publication_stage: "published", scope: { building_ids: ["bld-cobalt"] },
    published: { revision, publication_stage: "published", building_id: "bld-cobalt" },
    workflow: { revision, publication_stage: "published", requests: [], packages: [], activities: [], audit: [] },
    reports: { revision, publication_stage: "published", reports: [], activities: [], audit: [] },
  };
}

describe("shared operations snapshot HTTP adapter", () => {
  it("deduplicates concurrent surface reads onto one actor-scoped request", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot()), { status: 200 }));
    const [first, second] = await Promise.all([
      fetchOperationsSnapshot({ baseUrl: "https://demo.example/", fetcher }),
      fetchOperationsSnapshot({ baseUrl: "https://demo.example/", fetcher }),
    ]);
    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://demo.example/api/operations/snapshot?actor_id=usr-manager", {
      headers: { Accept: "application/json" },
    });
  });

  it("rejects a response whose nested projections drift from the canonical revision", async () => {
    const mismatched = snapshot();
    mismatched.reports.revision = 5;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(mismatched), { status: 200 }));
    await expect(fetchOperationsSnapshot({ fetcher })).rejects.toThrow("canonical revision");
  });

  it.each(["candidate_text", "content_fingerprint", "stored_filename", "reviewer"])(
    "rejects published document references containing private %s",
    async (privateKey) => {
      const unsafe = snapshot() as ReturnType<typeof snapshot> & {
        published_documents: Array<Record<string, unknown>>;
      };
      unsafe.published_documents = [{
        building_id: "bld-cobalt",
        document_type: "leasing_flyer",
        reviewed_summary: "Synthetic leasing reference summary.",
        [privateKey]: "private-value",
      }];
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(unsafe), { status: 200 }));

      await expect(fetchOperationsSnapshot({ fetcher })).rejects.toThrow(`forbidden public field: ${privateKey}`);
    },
  );

  it("rejects a top-level document outside the actor-scoped building list", async () => {
    const unsafe = {
      ...snapshot(),
      published_documents: [{
        building_id: "bld-pacific-gate",
        document_type: "leasing_flyer",
        reviewed_summary: "Synthetic leasing reference summary.",
      }],
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(unsafe), { status: 200 }));

    await expect(fetchOperationsSnapshot({ fetcher })).rejects.toThrow("outside the authorized building scope");
  });
});
