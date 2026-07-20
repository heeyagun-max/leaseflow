import { afterEach, describe, expect, it, vi } from "vitest";

const loadSnapshot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/operations-snapshot-public.server", () => ({ loadOperationsSnapshotPublic: loadSnapshot }));

import { GET, OPTIONS } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  loadSnapshot.mockReset();
});

describe("shared operations snapshot route", () => {
  it("serves one actor-scoped no-store envelope with Expo Web CORS", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    loadSnapshot.mockResolvedValue({ snapshot_version: 1, revision: 3 });
    const response = await GET(new Request("http://localhost/api/operations/snapshot?actor_id=usr-manager"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(loadSnapshot).toHaveBeenCalledWith("usr-manager");
    await expect(response.json()).resolves.toEqual({ snapshot_version: 1, revision: 3 });
  });

  it("rejects missing and unauthorized actor scopes", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const missing = await GET(new Request("http://localhost/api/operations/snapshot"));
    expect(missing.status).toBe(400);
    loadSnapshot.mockRejectedValue(new Error("Demo user usr-senior is not authorized for building bld-cobalt."));
    const forbidden = await GET(new Request("http://localhost/api/operations/snapshot?actor_id=usr-senior"));
    expect(forbidden.status).toBe(403);
  });

  it("provides a bodyless preflight and fails closed outside demo mode", async () => {
    const preflight = await OPTIONS();
    expect(preflight.status).toBe(204);
    expect(await preflight.text()).toBe("");
    vi.stubEnv("DEMO_MODE", "false");
    const response = await GET(new Request("http://localhost/api/operations/snapshot?actor_id=usr-manager"));
    expect(response.status).toBe(404);
  });
});
