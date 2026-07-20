import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("synthetic sample source download", () => {
  it("downloads the allowlisted demo source without caching", async () => {
    vi.stubEnv("DEMO_MODE", "true");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="LeaseFlow_Synthetic_Building_Update.json"',
    );
    expect(await response.json()).toMatchObject({
      id: "src-cobalt-jul",
      building_id: "bld-cobalt",
    });
  });

  it("is unavailable outside demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "false");

    const response = await GET();

    expect(response.status).toBe(404);
  });
});
