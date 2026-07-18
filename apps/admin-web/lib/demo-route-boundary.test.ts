import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as confirm } from "../app/api/demo/confirm/route";
import { POST as extract } from "../app/api/demo/extract/route";
import { POST as publish } from "../app/api/demo/publish/route";
import { POST as reset } from "../app/api/demo/reset/route";
import { GET as workflow } from "../app/api/demo/workflow/route";
import { GET as mobileFile } from "../app/api/mobile/files/[filename]/route";
import { GET as mobilePublished } from "../app/api/mobile/published/route";
import { POST as extractRequest } from "../app/api/ai/extract-request/route";
import { GET as mobileWorkflow, OPTIONS as mobileWorkflowOptions } from "../app/api/mobile/workflow/route";
import { classifyWorkflowError } from "./workflow-error.server";

const tempDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.sequential("synthetic demo route boundary", () => {
  it("fails closed for every demo workflow route unless DEMO_MODE is exactly true", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    expect((await workflow()).status).toBe(404);
    for (const handler of [extract, confirm, publish, reset]) {
      const request = new Request("http://localhost/api/demo/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_id: "usr-senior", expected_revision: 0 }),
      });
      const response = await handler(request);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringContaining("DEMO_MODE=true"),
      });
    }
  });

  it("fails closed for mobile data and files outside explicit demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const publishedResponse = await mobilePublished();
    expect(publishedResponse.status).toBe(404);
    await expect(publishedResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("DEMO_MODE=true"),
    });

    const fileResponse = await mobileFile(
      new Request("http://localhost/api/mobile/files/CFC_5F_plan_v1.svg"),
      { params: Promise.resolve({ filename: "CFC_5F_plan_v1.svg" }) },
    );
    expect(fileResponse.status).toBe(404);
    await expect(fileResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("DEMO_MODE=true"),
    });

    const workflowResponse = await mobileWorkflow();
    expect(workflowResponse.status).toBe(404);
    await expect(workflowResponse.json()).resolves.toMatchObject({ code: "DEMO_DISABLED" });
  });

  it("provides CORS preflight without exposing demo state", async () => {
    const response = await mobileWorkflowOptions();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("requires an explicit strict synthetic request source", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    for (const body of [{}, { source: "sms" }, { source: "call", extra: true }]) {
      const response = await extractRequest(new Request("http://localhost/api/ai/extract-request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: "INVALID_REQUEST" });
    }
    for (const source of ["call", "email"] as const) {
      const response = await extractRequest(new Request("http://localhost/api/ai/extract-request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }),
      }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ mode: "credential_free_demo" });
    }
  });

  it("fails closed for synthetic request extraction outside demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const response = await extractRequest(new Request("http://localhost/api/ai/extract-request", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "call" }),
    }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "DEMO_DISABLED" });
  });

  it("maps cross-package idempotency reuse to a stable HTTP conflict", async () => {
    expect(classifyWorkflowError(new Error("Idempotency key is already assigned to another package."))).toEqual({
      status: 409,
      body: { code: "IDEMPOTENCY_CONFLICT", error: "Idempotency key is already assigned to another package." },
    });
  });

  it("serves only the current published file inside explicit demo mode", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-mobile-boundary-"));
    tempDirectories.push(directory);
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("LEASEFLOW_DEMO_STATE_PATH", path.join(directory, "state.v1.json"));

    const publishedResponse = await mobilePublished();
    expect(publishedResponse.status).toBe(200);
    await expect(publishedResponse.json()).resolves.toMatchObject({
      floor_plan: { filename: "CFC_5F_plan_v1.svg" },
    });

    const currentFileResponse = await mobileFile(
      new Request("http://localhost/api/mobile/files/CFC_5F_plan_v1.svg"),
      { params: Promise.resolve({ filename: "CFC_5F_plan_v1.svg" }) },
    );
    expect(currentFileResponse.status).toBe(200);
    expect(currentFileResponse.headers.get("content-type")).toContain("image/svg+xml");

    const candidateFileResponse = await mobileFile(
      new Request("http://localhost/api/mobile/files/CFC_5F_plan_v2.svg"),
      { params: Promise.resolve({ filename: "CFC_5F_plan_v2.svg" }) },
    );
    expect(candidateFileResponse.status).toBe(410);
  });

  it("does not expose proposed fixture values through the workflow response before extraction", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-demo-boundary-"));
    tempDirectories.push(directory);
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("LEASEFLOW_DEMO_STATE_PATH", path.join(directory, "state.v1.json"));
    const response = await workflow();
    expect(response.status).toBe(200);
    const body = await response.json() as {
      source: Record<string, unknown>;
      state: { candidates: unknown[]; records: Array<{ status: string }>; files: Array<{ status: string }> };
    };
    expect(body.source).not.toHaveProperty("changes");
    expect(body.source).not.toHaveProperty("content");
    expect(body.state.candidates).toEqual([]);
    expect(body.state.records.every((record) => record.status === "published")).toBe(true);
    expect(body.state.files.every((file) => file.status === "published")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("CFC_5F_plan_v2.svg");
    expect(JSON.stringify(body)).not.toContain('"value":200');
  });
});
