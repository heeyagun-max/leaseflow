#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_ACTOR_ID = "usr-manager";

function normalizedBaseUrl(value) {
  const parsed = new URL(value || DEFAULT_BASE_URL);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("LEASEFLOW_API_URL must use http:// or https://.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function readJson(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON content (HTTP ${response.status}).`);
  }
}

async function getRevision(fetchImpl, baseUrl, actorId) {
  const response = await fetchImpl(`${baseUrl}/api/demo/workflow?actor_id=${encodeURIComponent(actorId)}`, {
    headers: { Accept: "application/json" },
  });
  const body = await readJson(response, "Demo workflow");
  if (!response.ok) throw new Error(body.error ?? `Demo workflow failed (HTTP ${response.status}).`);
  if (!Number.isInteger(body?.state?.revision) || body.state.revision < 0) {
    throw new Error("Demo workflow response did not contain a valid state.revision.");
  }
  return body.state.revision;
}

async function postReset(fetchImpl, baseUrl, actorId, revision) {
  const response = await fetchImpl(`${baseUrl}/api/demo/reset`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ actor_id: actorId, expected_revision: revision }),
  });
  const body = await readJson(response, "Demo reset");
  return { response, body };
}

export async function resetDemo({
  baseUrl = process.env.LEASEFLOW_API_URL ?? DEFAULT_BASE_URL,
  actorId = process.env.LEASEFLOW_DEMO_RESET_ACTOR_ID ?? DEFAULT_ACTOR_ID,
  fetchImpl = fetch,
} = {}) {
  const apiBaseUrl = normalizedBaseUrl(baseUrl);
  let revision = await getRevision(fetchImpl, apiBaseUrl, actorId);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { response, body } = await postReset(fetchImpl, apiBaseUrl, actorId, revision);
    if (response.ok) {
      if (!Number.isInteger(body?.state?.revision)) {
        throw new Error("Demo reset response did not contain a valid state.revision.");
      }
      return { baseUrl: apiBaseUrl, previousRevision: revision, revision: body.state.revision };
    }
    if (response.status === 409 && attempt === 0 && Number.isInteger(body.current_revision)) {
      revision = body.current_revision;
      continue;
    }
    throw new Error(body.error ?? `Demo reset failed (HTTP ${response.status}).`);
  }
}

async function main() {
  try {
    const result = await resetDemo();
    console.log(`Demo reset complete: revision ${result.previousRevision} -> ${result.revision} (${result.baseUrl})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Demo reset failed: ${message}`);
    console.error("Start the Admin demo first with `npm run demo:admin`.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
