import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod/v3";

const SourceCandidateValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const SourceCandidateSchema = z.object({
  building_id: z.string(),
  effective_date: z.string(),
  changes: z.array(z.object({
    field: z.string(),
    floor: z.string().nullable(),
    previous_value: SourceCandidateValueSchema,
    proposed_value: SourceCandidateValueSchema,
    state: z.enum(["confirmed", "under_discussion", "unverified"]),
    external_shareable_candidate: z.boolean(),
    source_pointer: z.string(),
    confidence: z.number().min(0).max(1),
  }).strict()),
  unresolved: z.array(z.object({field: z.string(), question: z.string()}).strict()),
}).strict();

export const RequestSchema = z.object({
  language: z.enum(["ko", "en", "mixed"]),
  building_mentions: z.array(z.object({
    text: z.string(),
    resolved_building_id: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  }).strict()).min(1),
  floor: z.string().nullable(),
  requested_fields: z.array(z.enum(["marketed_area", "rent_free", "supported_parking"])),
  requested_files: z.array(z.enum(["current_floor_plan"])),
  recipient: z.object({name: z.string().nullable(), organization: z.string().nullable()}).strict(),
  deadline: z.string().nullable(),
  ambiguities: z.array(z.object({field: z.string(), reason: z.string()}).strict()),
}).strict();

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

export const PackageEditSchema = z.object({
  tone: z.enum(["neutral", "concise_courteous", "formal"]),
}).strict();

export type SourceCandidate = z.infer<typeof SourceCandidateSchema>;
export type ParsedRequest = z.infer<typeof RequestSchema>;
export type ReportPatch = z.infer<typeof ReportPatchSchema>;
export type PackageEdit = z.infer<typeof PackageEditSchema>;

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
