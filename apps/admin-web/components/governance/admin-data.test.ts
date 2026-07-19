import { describe, expect, it, vi } from "vitest";
import { loadAdminDataSnapshot } from "./admin-data";

describe("admin shared data refresh", () => {
  it("refreshes both workflow revisions after reset and report mutations", async () => {
    let revision = 1;
    const fetcher = vi.fn(async (path: string) => new Response(JSON.stringify(
      path.startsWith("/api/demo/workflow?")
        ? { state: { revision } }
        : { revision, reports: [] },
    )));

    const initial = await loadAdminDataSnapshot(fetcher);
    revision = 2;
    const afterReset = await loadAdminDataSnapshot(fetcher);
    revision = 3;
    const afterReportMutation = await loadAdminDataSnapshot(fetcher);

    expect(initial.workflow?.state.revision).toBe(1);
    expect(initial.reportWorkflow?.revision).toBe(1);
    expect(afterReset.workflow?.state.revision).toBe(2);
    expect(afterReset.reportWorkflow?.revision).toBe(2);
    expect(afterReportMutation.workflow?.state.revision).toBe(3);
    expect(afterReportMutation.reportWorkflow?.revision).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it("clears a failed endpoint instead of retaining stale state", async () => {
    const fetcher = vi.fn(async (path: string) => path.startsWith("/api/demo/workflow?")
      ? new Response(JSON.stringify({ state: { revision: 4 } }))
      : new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }));

    const snapshot = await loadAdminDataSnapshot(fetcher);

    expect(snapshot.workflow?.state.revision).toBe(4);
    expect(snapshot.reportWorkflow).toBeNull();
    expect(snapshot.reportError).not.toBeNull();
  });

  it("retries one mismatched pair and returns only a consistent revision", async () => {
    let pair = 0;
    const fetcher = vi.fn(async (path: string) => {
      const revision = pair < 2 ? (path.startsWith("/api/demo/workflow?") ? 1 : 2) : 3;
      pair += 1;
      return new Response(JSON.stringify(path.startsWith("/api/demo/workflow?")
        ? { state: { revision } }
        : { revision, reports: [] }));
    });
    const snapshot = await loadAdminDataSnapshot(fetcher);
    expect(snapshot.workflow?.state.revision).toBe(3);
    expect(snapshot.reportWorkflow?.revision).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("fails closed after a persistent revision mismatch", async () => {
    const fetcher = vi.fn(async (path: string) => new Response(JSON.stringify(
      path.startsWith("/api/demo/workflow?") ? { state: { revision: 4 } } : { revision: 5, reports: [] },
    )));
    const snapshot = await loadAdminDataSnapshot(fetcher);
    expect(snapshot.workflow).toBeNull();
    expect(snapshot.reportWorkflow).toBeNull();
    expect(snapshot.error).toContain("기준 시점");
  });
});
