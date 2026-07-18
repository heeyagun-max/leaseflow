export type ReportLifecycleStep = "approve" | "draft" | "investigate" | "send";
export type ReportLifecycleStepState = "blocked" | "complete" | "current" | "pending";
export type ReportLifecycleStatus = "approved" | "draft" | "patch_pending" | "sent" | "stale";

export interface ReportProgress {
  acceptedPatchCount: number;
  hasPendingCandidate: boolean;
  status: ReportLifecycleStatus;
}

export function reportLifecycleStepState(
  progress: ReportProgress,
  target: ReportLifecycleStep,
): ReportLifecycleStepState {
  if (progress.status === "stale") return target === "draft" ? "blocked" : "pending";
  if (progress.status === "sent") return "complete";
  if (progress.status === "approved") return target === "send" ? "current" : "complete";
  if (target === "draft") return "complete";
  if (progress.status === "patch_pending" || progress.hasPendingCandidate) {
    return target === "investigate" ? "current" : "pending";
  }
  if (progress.acceptedPatchCount > 0) {
    if (target === "investigate") return "complete";
    return target === "approve" ? "current" : "pending";
  }
  return target === "investigate" ? "current" : "pending";
}
