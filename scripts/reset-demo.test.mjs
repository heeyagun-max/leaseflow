import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { resetDemo } from "./reset-demo.mjs";

let baseUrl;
let revision = 7;
let conflictOnNextReset = false;
let workflowReads = 0;
let resetWrites = 0;
let server;

before(async () => {
  server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.method === "GET" && request.url === "/api/demo/workflow") {
      workflowReads += 1;
      response.end(JSON.stringify({ state: { revision } }));
      return;
    }
    if (request.method === "POST" && request.url === "/api/demo/reset") {
      let body = "";
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        resetWrites += 1;
        const input = JSON.parse(body);
        if (conflictOnNextReset) {
          conflictOnNextReset = false;
          revision += 1;
          response.statusCode = 409;
          response.end(JSON.stringify({ error: "revision conflict", current_revision: revision }));
          return;
        }
        if (input.expected_revision !== revision) {
          response.statusCode = 409;
          response.end(JSON.stringify({ error: "revision conflict", current_revision: revision }));
          return;
        }
        assert.equal(input.actor_id, "usr-manager");
        revision += 1;
        response.end(JSON.stringify({ state: { revision } }));
      });
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  revision = 7;
  conflictOnNextReset = false;
  workflowReads = 0;
  resetWrites = 0;
});

test("reads the current revision before posting a reset", async () => {
  const result = await resetDemo({ baseUrl });
  assert.deepEqual(result, { baseUrl, previousRevision: 7, revision: 8 });
  assert.equal(workflowReads, 1);
  assert.equal(resetWrites, 1);
});

test("retries once with current_revision after a reset conflict", async () => {
  conflictOnNextReset = true;

  const result = await resetDemo({ baseUrl });

  assert.deepEqual(result, { baseUrl, previousRevision: 8, revision: 9 });
  assert.equal(workflowReads, 1);
  assert.equal(resetWrites, 2);
});
