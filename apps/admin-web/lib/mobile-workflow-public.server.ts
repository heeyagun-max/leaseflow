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
      id: pkg.id, building_id: pkg.building_id, floor: pkg.floor, status: pkg.status, subject: pkg.subject, body: pkg.body,
      facts: pkg.facts.map(({ label, value, unit, version_id, source_pointer }) => ({ label, value, unit, version_id, source_pointer })),
      files: pkg.files.map(({ filename, version_id, source_pointer }) => ({ filename, version_id, source_pointer })),
      recipients: pkg.recipients, unresolved: pkg.unresolved, protected_material_status: "verified" as const,
      edit_candidate: pkg.edit_candidate ? { subject: pkg.edit_candidate.subject, body: pkg.edit_candidate.body } : null,
    })),
    activities: state.operations.activities.map(({ event_type, package_id, building_id, occurred_at, summary }) => ({ event_type, package_id, building_id, occurred_at, summary })),
    audit: [...state.audit, ...state.operations.audit].map((event) => ({ event_label: event.event_type, occurred_at: event.occurred_at })),
    labels: { mode: "DEMO", role: "LM Manager", delivery: "SANDBOX ONLY" },
  });
}
