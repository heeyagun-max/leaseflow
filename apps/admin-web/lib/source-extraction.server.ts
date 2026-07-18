import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  SourceCandidateSchema,
  createStructuredResponse,
  type SourceCandidate,
} from "@leaseflow/ai";
import { extractDemoSourceCandidates } from "@leaseflow/demo-data";
import { z } from "zod/v3";

const syntheticSourceSchema = z.object({
  id: z.literal("src-cobalt-jul"),
  building_id: z.literal("bld-cobalt"),
  title: z.string().min(1),
  effective_date: z.literal("2026-07-18"),
  source_type: z.literal("monthly_owner_update"),
  content: z.object({
    floor: z.literal("5F"),
    previous_marketed_area_py: z.number(),
    current_marketed_area_py: z.number(),
    reason: z.string().min(1),
    previous_rent_free_months: z.number(),
    current_rent_free_months: z.number(),
    previous_supported_parking_spaces: z.number(),
    current_supported_parking_spaces: z.number(),
    previous_plan: z.string().min(1),
    current_plan: z.string().min(1),
  }).strict(),
}).strict();

export interface SourceExtractionAdapterInput {
  schema: typeof SourceCandidateSchema;
  schemaName: string;
  developer: string;
  user: string;
  model?: string;
}

export type SourceExtractionAdapter = (
  input: SourceExtractionAdapterInput,
) => Promise<unknown>;

interface SourceExtractionEnvironment {
  DEMO_MODE?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

export interface SourceExtractionServiceOptions {
  adapter?: SourceExtractionAdapter;
  environment?: SourceExtractionEnvironment;
  loadSource?: () => Promise<unknown>;
}

export interface SourceExtractionServiceResult {
  mode: "live" | "credential_free_demo";
  candidates: SourceCandidate;
}

function repositoryRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
}

async function loadSyntheticSource(): Promise<unknown> {
  const raw = await readFile(path.join(repositoryRoot(), "data/demo/source_update.json"), "utf8");
  return JSON.parse(raw) as unknown;
}

const defaultAdapter: SourceExtractionAdapter = (input) => createStructuredResponse(input);

export async function extractSyntheticSource(
  options: SourceExtractionServiceOptions = {},
): Promise<SourceExtractionServiceResult> {
  const environment = options.environment ?? process.env;
  const source = syntheticSourceSchema.parse(await (options.loadSource ?? loadSyntheticSource)());
  if (environment.DEMO_MODE === "true" && !environment.OPENAI_API_KEY) {
    return {
      mode: "credential_free_demo",
      candidates: SourceCandidateSchema.parse(extractDemoSourceCandidates(source)),
    };
  }

  const adapterInput: SourceExtractionAdapterInput = {
    schema: SourceCandidateSchema,
    schemaName: "leaseflow_source_candidate",
    developer: "Extract candidate leasing-data changes. Never approve or publish. Include source pointers and unresolved items.",
    user: JSON.stringify(source),
    ...(environment.OPENAI_MODEL ? { model: environment.OPENAI_MODEL } : {}),
  };
  const output = await (options.adapter ?? defaultAdapter)(adapterInput);
  return { mode: "live", candidates: SourceCandidateSchema.parse(output) };
}
