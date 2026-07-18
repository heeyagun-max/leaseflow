import { readFile } from "node:fs/promises";
import path from "node:path";
import { RequestSchema, createStructuredResponse, type ParsedRequest } from "@leaseflow/ai";
import { z } from "zod/v3";

const callFixtureSchema = z.object({
  id: z.string(), channel: z.literal("call_transcript"), occurred_at: z.string(), contact: z.string(),
  organization: z.string(), text: z.string().min(1), expected_task: z.unknown(),
}).strict();
const emailFixtureSchema = z.object({
  id: z.string(), source: z.literal("email"), subject: z.string(), from: z.string().email(), body: z.string().min(1),
}).strict();

export type DemoRequestSource = "call" | "email";
export interface RequestFixture { id: string; source: DemoRequestSource; raw_text: string; payload: unknown }
export interface RequestExtractionAdapterInput {
  schema: typeof RequestSchema; schemaName: string; developer: string; user: string; model?: string;
}
export type RequestExtractionAdapter = (input: RequestExtractionAdapterInput) => Promise<unknown>;
export interface RequestExtractionServiceOptions {
  adapter?: RequestExtractionAdapter;
  environment?: { DEMO_MODE?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
  loadFixture?: (source: DemoRequestSource) => Promise<RequestFixture>;
}
export interface RequestExtractionResult { mode: "live" | "credential_free_demo"; fixture: RequestFixture; extraction: ParsedRequest }

function repositoryRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
}

export async function loadSyntheticRequestFixture(source: DemoRequestSource): Promise<RequestFixture> {
  const filename = source === "call" ? "call_request.json" : "email_request.json";
  const raw = await readFile(path.join(repositoryRoot(), "data/demo", filename), "utf8");
  const payload: unknown = JSON.parse(raw);
  if (source === "call") {
    const fixture = callFixtureSchema.parse(payload);
    return {
      id: fixture.id, source, raw_text: fixture.text,
      payload: { channel: fixture.channel, contact: fixture.contact, organization: fixture.organization, text: fixture.text },
    };
  }
  const fixture = emailFixtureSchema.parse(payload);
  return {
    id: fixture.id, source, raw_text: `${fixture.subject}\n${fixture.body}`,
    payload: { source: fixture.source, subject: fixture.subject, from: fixture.from, body: fixture.body },
  };
}

export function demoRequestExtraction(source: DemoRequestSource): ParsedRequest {
  return RequestSchema.parse({
    language: source === "call" ? "ko" : "en",
    building_mentions: [{ text: source === "call" ? "코발트 파이낸스센터" : "Cobalt Finance Center", resolved_building_id: "bld-cobalt", confidence: 0.99 }],
    floor: "5F", requested_fields: ["marketed_area", "rent_free", "supported_parking"],
    requested_files: ["current_floor_plan"],
    recipient: { name: "Alex Chen", organization: "Northbridge Advisory" },
    deadline: "today afternoon", ambiguities: [],
  });
}

const defaultAdapter: RequestExtractionAdapter = (input) => createStructuredResponse(input);

export async function extractSyntheticRequest(
  source: DemoRequestSource,
  options: RequestExtractionServiceOptions = {},
): Promise<RequestExtractionResult> {
  const environment = options.environment ?? process.env;
  const fixture = await (options.loadFixture ?? loadSyntheticRequestFixture)(source);
  if (environment.DEMO_MODE === "true" && !environment.OPENAI_API_KEY) {
    return { mode: "credential_free_demo", fixture, extraction: demoRequestExtraction(source) };
  }
  const adapterInput: RequestExtractionAdapterInput = {
    schema: RequestSchema,
    schemaName: "leaseflow_request",
    developer: "Extract a leasing-work request candidate. Do not invent official facts, files, recipients, or authorization.",
    user: JSON.stringify(fixture.payload),
    ...(environment.OPENAI_MODEL ? { model: environment.OPENAI_MODEL } : {}),
  };
  const output = await (options.adapter ?? defaultAdapter)(adapterInput);
  return { mode: "live", fixture, extraction: RequestSchema.parse(output) };
}
