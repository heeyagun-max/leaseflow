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

export const INVESTIGATION_COMMANDS = [
  "통화내용 확인해서 이번주 변동사항 업데이트 해",
  "이메일 확인해서 이번주 변동사항 업데이트 해",
  "협의 중인 면적 변동 있는지 확인해",
  "협의 중인 층 변동 있는지 확인해",
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐",
] as const;

export const REPORT_SECTIONS = [
  "key_issue",
  "changes_since_last_report",
  "activity_summary",
  "blocker",
  "next_action",
  "competitor_buildings",
] as const;

export const InvestigationCommandSchema = z.enum(INVESTIGATION_COMMANDS);
export const ReportSectionSchema = z.enum(REPORT_SECTIONS);

const NonemptyIdentifierSchema = z.string()
  .min(1)
  .refine((value) => value.trim() === value, "Identifiers must not have surrounding whitespace.");
const SourceActivityIdsSchema = z.array(NonemptyIdentifierSchema)
  .min(1)
  .refine(
    (sourceIds) => new Set(sourceIds).size === sourceIds.length,
    "Source activity IDs must be unique.",
  );
const ReportValueSchema = z.union([z.string(), z.array(z.string())]);

export const ReportPatchSchema = z.object({
  command: InvestigationCommandSchema,
  building_id: NonemptyIdentifierSchema,
  findings: z.array(z.object({
    category: ReportSectionSchema,
    finding: z.string().min(1),
    source_activity_ids: SourceActivityIdsSchema,
    confidence: z.number().finite().min(0).max(1),
  }).strict()).min(1),
  operations: z.array(z.object({
    section: ReportSectionSchema,
    operation: z.literal("replace"),
    before: ReportValueSchema,
    after: ReportValueSchema,
    source_activity_ids: SourceActivityIdsSchema,
  }).strict()).min(1),
  unresolved: z.array(z.object({
    field: z.string().min(1),
    question: z.string().min(1),
  }).strict()),
}).strict();

export const PackageEditSchema = z.object({
  tone: z.enum(["neutral", "concise_courteous", "formal"]),
}).strict();

export type SourceCandidate = z.infer<typeof SourceCandidateSchema>;
export type ParsedRequest = z.infer<typeof RequestSchema>;
export type InvestigationCommand = z.infer<typeof InvestigationCommandSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReportPatch = z.infer<typeof ReportPatchSchema>;
export type PackageEdit = z.infer<typeof PackageEditSchema>;

export interface ReportPatchGenerationInput {
  building_id: string;
  report_period: string;
  current_report: unknown;
  app_activity: unknown;
  mock_outlook_activity: unknown;
  command: InvestigationCommand;
  model?: string;
}

export interface ReportPatchGenerationAdapterInput {
  schema: typeof ReportPatchSchema;
  schemaName: string;
  developer: string;
  user: string;
  model?: string;
}

export type ReportPatchGenerationAdapter = (
  input: ReportPatchGenerationAdapterInput,
) => Promise<unknown>;

export interface ReportPatchGenerationOptions {
  adapter?: ReportPatchGenerationAdapter;
}

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

const defaultReportPatchGenerationAdapter: ReportPatchGenerationAdapter = (input) =>
  createStructuredResponse(input);

export async function generateReportPatchCandidate(
  input: ReportPatchGenerationInput,
  options: ReportPatchGenerationOptions = {},
): Promise<ReportPatch> {
  const buildingId = NonemptyIdentifierSchema.parse(input.building_id);
  const command = InvestigationCommandSchema.parse(input.command);
  const adapterInput: ReportPatchGenerationAdapterInput = {
    schema: ReportPatchSchema,
    schemaName: "leaseflow_weekly_report_patch",
    developer: [
      "Propose a source-backed weekly landlord report patch for exactly the requested building.",
      "Use replace operations only and cite nonempty source activity IDs for every finding and operation.",
      "Return a candidate only. Never authorize, approve, publish, apply, address, or send the report.",
    ].join(" "),
    user: JSON.stringify({
      building_id: buildingId,
      report_period: input.report_period,
      current_report: input.current_report,
      app_activity: input.app_activity,
      mock_outlook_activity: input.mock_outlook_activity,
      command,
    }),
    ...(input.model ? { model: input.model } : {}),
  };
  const candidate = ReportPatchSchema.parse(
    await (options.adapter ?? defaultReportPatchGenerationAdapter)(adapterInput),
  );
  if (candidate.building_id !== buildingId) {
    throw new Error("GPT-5.6 report patch targeted a different building.");
  }
  if (candidate.command !== command) {
    throw new Error("GPT-5.6 report patch returned a different investigation command.");
  }
  return candidate;
}
