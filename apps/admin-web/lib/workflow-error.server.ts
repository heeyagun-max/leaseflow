import { ZodError } from "zod/v3";
import {
  DemoStateCorruptError,
  RevisionConflictError,
  WeeklyReportStaleError,
} from "./demo-store.server";

export interface WorkflowErrorResponse {
  status: number;
  body: { code: string; error: string; current_revision?: number };
}

export function classifyWorkflowError(error: unknown): WorkflowErrorResponse {
  const message = error instanceof Error ? error.message : "Unknown workflow error.";
  if (message.includes("DEMO_MODE")) {
    return { status: 404, body: { code: "DEMO_DISABLED", error: "This demo route is disabled." } };
  }
  if (error instanceof RevisionConflictError) return { status: 409, body: { code: "REVISION_CONFLICT", error: message, current_revision: error.actual } };
  if (error instanceof WeeklyReportStaleError) {
    return {
      status: 409,
      body: {
        code: "WORKFLOW_STALE",
        error: "Weekly report inputs changed. Reload the current state before continuing.",
        current_revision: error.currentRevision,
      },
    };
  }
  if (error instanceof DemoStateCorruptError) {
    return { status: 500, body: { code: "STATE_CORRUPT", error: "Demo state is unavailable." } };
  }
  if (message.includes("Idempotency key is already assigned to another package")
    || message.includes("Idempotency key is already assigned to another weekly report")) {
    return { status: 409, body: { code: "IDEMPOTENCY_CONFLICT", error: message } };
  }
  if (message.includes("not allowed") || message.includes("not authorized")) return { status: 403, body: { code: "FORBIDDEN", error: message } };
  if (message.includes("stale") || message.includes("blocked") || message.includes("Only a") || message.includes("requires") || message.includes("diverged")) {
    return { status: 409, body: { code: "WORKFLOW_CONFLICT", error: message } };
  }
  if (error instanceof ZodError || error instanceof SyntaxError || message.startsWith("Unknown ")) {
    return { status: 400, body: { code: "INVALID_REQUEST", error: "The request is invalid." } };
  }
  return { status: 500, body: { code: "INTERNAL_ERROR", error: "The workflow could not be completed." } };
}
