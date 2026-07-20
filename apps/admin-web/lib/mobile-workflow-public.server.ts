import type { DemoState } from "@leaseflow/demo-data";
import { z } from "zod/v3";

const schema = z.object({
  revision: z.number().int().nonnegative(), publication_stage: z.string(),
  requests: z.array(z.object({ id: z.string(), source: z.enum(["call", "email"]), status: z.enum(["candidate", "confirmed"]), summary: z.object({
    building_id: z.string().nullable(), floor: z.string().nullable(), requested_fields: z.array(z.string()), requested_files: z.array(z.string()),
    recipient: z.object({ name: z.string().nullable(), organization: z.string().nullable() }).strict(), deadline: z.string().nullable(),
    ambiguities: z.array(z.object({ field: z.string(), reason: z.string() }).strict()),
  }).strict() }).strict()),
  packages: z.array(z.object({
    id: z.string(), building_id: z.string(), floor: z.string(), status: z.enum(["draft", "edit_pending", "approved", "sent", "stale"]),
    subject: z.string(), body: z.string(), facts: z.array(z.object({ label: z.string(), value: z.number(), unit: z.string(), version_id: z.string(), source_pointer: z.string() }).strict()),
    files: z.array(z.object({ filename: z.string(), version_id: z.string(), source_pointer: z.string() }).strict()),
    recipients: z.object({ to: z.array(z.string()), cc: z.array(z.string()), configuration_id: z.string() }).strict(),
    unresolved: z.array(z.string()), protected_material_status: z.literal("verified"), edit_candidate: z.object({ subject: z.string(), body: z.string() }).strict().nullable(),
  }).strict()),
  activities: z.array(z.object({ event_type: z.literal("package.sent.sandbox"), package_id: z.string(), building_id: z.string(), occurred_at: z.string(), summary: z.string() }).strict()),
  audit: z.array(z.object({ event_label: z.string(), occurred_at: z.string() }).strict()),
  labels: z.object({ mode: z.literal("DEMO"), role: z.literal("LM Manager"), delivery: z.literal("SANDBOX ONLY") }).strict(),
}).strict();

export type PublicWorkflow = z.infer<typeof schema>;

const publicFactLabels: Record<string, string> = {
  marketed_area_py: "임대 가능 면적",
  "Marketed area": "임대 가능 면적",
  rent_free_months: "렌트프리",
  "Rent-free": "렌트프리",
  supported_parking_spaces: "지원 주차",
  "Supported parking": "지원 주차",
};
const publicUnits: Record<string, string> = { py: "평", months: "개월", spaces: "대" };

export function renderPublicPackageBody(
  facts: readonly { label: string; value: number; unit: string }[],
  files: readonly { filename: string }[],
  tone: "neutral" | "concise_courteous" | "formal" = "neutral",
): string {
  const factLines = facts.map((fact) => `- ${publicFactLabels[fact.label] ?? "임대 정보"}: ${fact.value}${publicUnits[fact.unit] ?? fact.unit}`);
  const fileLines = files.map((file) => `- 첨부 자료: ${file.filename}`);
  const copy = {
    neutral: ["안녕하세요. 요청하신 현재 임대 정보를 안내드립니다.", "내용을 확인한 뒤 전달해 주세요."],
    concise_courteous: ["안녕하세요. 요청하신 최신 임대 정보를 간단히 정리했습니다.", "확인 부탁드립니다. 감사합니다."],
    formal: ["안녕하십니까. 요청하신 현재 임대 정보를 아래와 같이 안내드립니다.", "검토 부탁드립니다.\n감사합니다."],
  } as const;
  return [
    copy[tone][0],
    "",
    ...factLines,
    ...fileLines,
    "",
    copy[tone][1],
  ].join("\n");
}

function publicToneFor(body: string): "neutral" | "concise_courteous" | "formal" {
  if (body.startsWith("Hello,")) return "concise_courteous";
  if (body.startsWith("Please find below")) return "formal";
  return "neutral";
}

export function toPublicWorkflow(state: DemoState): PublicWorkflow {
  return schema.parse({
    revision: state.revision, publication_stage: state.stage,
    requests: state.operations.requests.map((request) => ({
      id: request.id, source: request.source, status: request.status,
      summary: { building_id: request.extraction.building_mentions[0]?.resolved_building_id ?? null, floor: request.extraction.floor,
        requested_fields: request.extraction.requested_fields, requested_files: request.extraction.requested_files,
        recipient: request.extraction.recipient, deadline: request.extraction.deadline, ambiguities: request.extraction.ambiguities },
    })),
    packages: state.operations.packages.map((pkg) => ({
      id: pkg.id, building_id: pkg.building_id, floor: pkg.floor, status: pkg.status, subject: pkg.subject,
      body: renderPublicPackageBody(pkg.facts, pkg.files, publicToneFor(pkg.body)),
      facts: pkg.facts.map(({ label, value, unit, version_id, source_pointer }) => ({ label, value, unit, version_id, source_pointer })),
      files: pkg.files.map(({ filename, version_id, source_pointer }) => ({ filename, version_id, source_pointer })),
      recipients: pkg.recipients, unresolved: pkg.unresolved, protected_material_status: "verified" as const,
      edit_candidate: pkg.edit_candidate ? {
        subject: pkg.edit_candidate.subject,
        body: renderPublicPackageBody(pkg.facts, pkg.files, publicToneFor(pkg.edit_candidate.body)),
      } : null,
    })),
    activities: state.operations.activities.map(({ event_type, package_id, building_id, occurred_at, summary }) => ({ event_type, package_id, building_id, occurred_at, summary })),
    audit: [...state.audit, ...state.operations.audit].map((event) => ({ event_label: event.event_type, occurred_at: event.occurred_at })),
    labels: { mode: "DEMO", role: "LM Manager", delivery: "SANDBOX ONLY" },
  });
}
