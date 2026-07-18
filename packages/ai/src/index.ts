import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod/v3";

export const SourceCandidateSchema = z.object({
  building_id: z.string(),
  effective_date: z.string(),
  changes: z.array(z.object({
    field: z.string(),
    floor: z.string().nullable(),
    previous_value: z.unknown(),
    proposed_value: z.unknown(),
    state: z.enum(["confirmed", "under_discussion", "unverified"]),
    external_shareable_candidate: z.boolean(),
    source_pointer: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  unresolved: z.array(z.object({field: z.string(), question: z.string()})),
});

export const RequestSchema = z.object({
  language: z.enum(["ko", "en", "mixed"]),
  building_mentions: z.array(z.object({
    text: z.string(),
    resolved_building_id: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  })),
  floor: z.string().nullable(),
  requested_fields: z.array(z.string()),
  requested_files: z.array(z.string()),
  recipient: z.object({name: z.string().nullable(), organization: z.string().nullable()}),
  deadline: z.string().nullable(),
  ambiguities: z.array(z.object({field: z.string(), reason: z.string()})),
});

export const ReportPatchSchema = z.object({
  target_building_ids: z.array(z.string()),
  findings: z.array(z.object({
    category: z.string(),
    finding: z.string(),
    source_activity_ids: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),
  operations: z.array(z.object({
    section: z.string(),
    operation: z.enum(["replace", "append", "remove", "reorder"]),
    before: z.unknown(),
    after: z.unknown(),
    source_activity_ids: z.array(z.string()),
  })),
  unresolved: z.array(z.object({field: z.string(), question: z.string()})),
});

export type SourceCandidate = z.infer<typeof SourceCandidateSchema>;
export type ParsedRequest = z.infer<typeof RequestSchema>;
export type ReportPatch = z.infer<typeof ReportPatchSchema>;

export function createOpenAIClient(apiKey = process.env.OPENAI_API_KEY): OpenAI {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for live GPT-5.6 calls.");
  return new OpenAI({ apiKey });
}

export async function createStructuredResponse<T>(input: {
  schema: z.ZodType<T>;
  schemaName: string;
  developer: string;
  user: string;
  model?: string;
}): Promise<T> {
  const model = input.model ?? process.env.OPENAI_MODEL;
  if (!model) throw new Error("Set OPENAI_MODEL to the GPT-5.6 model identifier available in your project.");
  const client = createOpenAIClient();
  const response = await client.responses.parse({
    model,
    store: false,
    input: [
      { role: "developer", content: input.developer },
      { role: "user", content: input.user },
    ],
    text: {
      format: zodTextFormat(input.schema, input.schemaName),
    },
  });
  if (response.output_parsed === null) {
    throw new Error("GPT-5.6 returned no structured output.");
  }
  return input.schema.parse(response.output_parsed);
}
