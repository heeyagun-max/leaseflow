import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPTIONS, POST } from "./route";

const tempDirectories: string[] = [];
const mobileOrigin = "https://mobile.demo.leaseflow.example";

function reset(body: unknown) {
  return POST(new Request("http://localhost:3000/api/demo/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: mobileOrigin,
    },
    body: JSON.stringify(body),
  }));
}

function expectDemoCors(response: Response) {
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type");
  expect(response.headers.get("access-control-allow-methods")).toBe("POST,OPTIONS");
  expect(response.headers.get("cache-control")).toBe("no-store");
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.sequential("demo reset route CORS boundary", () => {
  it("answers the Expo Web preflight without exposing state", async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expectDemoCors(response);
    expect(await response.text()).toBe("");
  });

  it("allows the Expo Web origin on a successful reset", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-reset-route-"));
    tempDirectories.push(directory);
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("LEASEFLOW_DEMO_STATE_PATH", path.join(directory, "state.json"));

    const response = await reset({ actor_id: "usr-manager", expected_revision: 0 });

    expect(response.status).toBe(200);
    expectDemoCors(response);
    await expect(response.json()).resolves.toMatchObject({ state: { revision: 1 } });
  });

  it("preserves CORS headers on rejected reset requests", async () => {
    vi.stubEnv("DEMO_MODE", "false");

    const response = await reset({ actor_id: "usr-manager", expected_revision: 0 });

    expect(response.status).toBe(404);
    expectDemoCors(response);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("DEMO_MODE=true"),
    });
  });
});
