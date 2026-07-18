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
]) {
  JSON.parse(readFileSync(resolve(file), "utf8"));
}

console.log("LeaseFlow starter pack validation passed.");
