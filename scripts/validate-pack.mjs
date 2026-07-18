import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "README.md",
  "AGENTS.md",
  "docs/PRODUCT_DIRECTION.md",
  "docs/HACKATHON_MVP_SCOPE.md",
  "prompts/codex_master_prompt.md",
  "packages/domain/src/index.ts",
  "packages/ai/src/index.ts",
  "apps/admin-web/app/page.tsx",
  "apps/mobile/app/index.tsx",
  "supabase/migrations/0001_initial.sql",
  "tests/golden_cases.yaml",
  "data/demo/source_update.json",
  "data/demo/building_access.json",
  "data/demo/broker_package_recipient_group.json",
  "data/demo/email_request.json",
];

const missing = required.filter((file) => !existsSync(resolve(file)));
if (missing.length) {
  console.error("Missing required files:", missing);
  process.exit(1);
}

for (const file of [
  "package.json",
  "data/demo/buildings.json",
  "data/demo/users.json",
  "data/demo/source_update.json",
  "data/demo/record_versions.json",
  "data/demo/file_versions.json",
  "data/demo/call_request.json",
  "data/demo/mock_outlook.json",
  "data/demo/recipient_group.json",
  "data/demo/building_access.json",
  "data/demo/broker_package_recipient_group.json",
  "data/demo/email_request.json",
]) {
  JSON.parse(readFileSync(resolve(file), "utf8"));
}

function assertStrictKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`${label} has unknown keys: ${extras.join(", ")}.`);
  const missingKeys = allowed.filter((key) => !(key in value));
  if (missingKeys.length) throw new Error(`${label} is missing keys: ${missingKeys.join(", ")}.`);
}

const access = JSON.parse(readFileSync(resolve("data/demo/building_access.json"), "utf8"));
assertStrictKeys(access, ["configuration_id", "users"], "building_access.json");
if (typeof access.configuration_id !== "string" || !Array.isArray(access.users)
  || access.users.some((user) => typeof user.user_id !== "string" || !Array.isArray(user.building_ids))) {
  throw new Error("Invalid building_access.json schema.");
}
for (const user of access.users) assertStrictKeys(user, ["user_id", "building_ids"], "building_access.json user");
const recipients = JSON.parse(readFileSync(resolve("data/demo/broker_package_recipient_group.json"), "utf8"));
assertStrictKeys(recipients, ["id", "building_id", "purpose", "recipient_name", "recipient_organization", "to", "cc"], "broker_package_recipient_group.json");
if (recipients.purpose !== "broker_package" || typeof recipients.building_id !== "string"
  || typeof recipients.recipient_name !== "string" || typeof recipients.recipient_organization !== "string"
  || !Array.isArray(recipients.to) || recipients.to.length === 0 || !Array.isArray(recipients.cc)) {
  throw new Error("Invalid broker_package_recipient_group.json schema.");
}
for (const address of [...recipients.to, ...recipients.cc]) {
  if (typeof address !== "string" || !/@.+\.(example|test)$/.test(address)) {
    throw new Error("Demo recipient addresses must use synthetic .example or .test domains.");
  }
}
const emailRequest = JSON.parse(readFileSync(resolve("data/demo/email_request.json"), "utf8"));
assertStrictKeys(emailRequest, ["id", "source", "subject", "from", "body"], "email_request.json");
if (emailRequest.source !== "email" || typeof emailRequest.subject !== "string"
  || typeof emailRequest.body !== "string" || !/@.+\.(example|test)$/.test(emailRequest.from)) {
  throw new Error("Invalid synthetic email_request.json schema.");
}
if (emailRequest.from !== recipients.to[0]) throw new Error("Synthetic email identity must match the configured To recipient.");

console.log("LeaseFlow starter pack validation passed.");
