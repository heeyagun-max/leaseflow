import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createDemoWeeklyReportDraftInput,
  selectExternalReportableMockOutlook,
  type DemoMockOutlookMessage,
} from "@leaseflow/demo-data";
import type {
  CreateWeeklyReportDraftInput,
  ReportSourceReference,
  WeeklyReportPeriod,
} from "@leaseflow/domain";
import { z } from "zod/v3";

const messageSchema = z.object({
  id: z.string().min(1),
  building_id: z.string().min(1),
  thread_id: z.string().min(1),
  occurred_at: z.string().datetime({ offset: true }),
  direction: z.enum(["inbound", "outbound"]),
  subject: z.string().min(1),
  body: z.string().min(1),
  share_scope: z.enum(["external_reportable", "client_confidential"]),
}).strict();

const fixtureSchema = z.array(messageSchema);

function fixturePath(): string {
  const cwd = process.cwd();
  const root = path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
  return path.join(root, "data/demo/mock_outlook.json");
}

function datePart(occurredAt: string): string {
  return occurredAt.slice(0, 10);
}

export async function loadExternalReportableMockOutlook(input: {
  buildingId: string;
  period: WeeklyReportPeriod;
  path?: string;
}): Promise<ReportSourceReference[]> {
  const raw = await readFile(input.path ?? fixturePath(), "utf8");
  const messages = fixtureSchema.parse(JSON.parse(raw)) as DemoMockOutlookMessage[];
  return selectExternalReportableMockOutlook(messages, input.buildingId)
    .filter((source) => {
      const occurredOn = datePart(source.occurred_at);
      return occurredOn >= input.period.from && occurredOn <= input.period.to;
    })
    .map((source) => ({
      ...source,
      summary: messages.find((message) => message.id === source.id)?.subject ?? source.summary,
    }));
}

export async function loadCanonicalWeeklyReportDraft(): Promise<CreateWeeklyReportDraftInput> {
  const draft = createDemoWeeklyReportDraftInput();
  const outlook = await loadExternalReportableMockOutlook({
    buildingId: draft.building_id,
    period: draft.reporting_period,
  });
  return {
    ...draft,
    sources: [
      ...draft.sources.filter((source) => source.source_type === "leaseflow_activity"),
      ...outlook,
    ],
  };
}
