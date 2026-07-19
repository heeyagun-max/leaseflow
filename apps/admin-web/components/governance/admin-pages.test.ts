import { describe, expect, it } from "vitest";
import { formatCandidateEvidence, matchesReviewBatchRef, resolveAuditRecordsState } from "./admin-pages";

describe("governance detail references", () => {
  it("accepts only the actual demo review batch reference", () => {
    expect(matchesReviewBatchRef("source-actual", "source-actual")).toBe(true);
    expect(matchesReviewBatchRef("arbitrary-batch", "source-actual")).toBe(false);
    expect(matchesReviewBatchRef(undefined, "source-actual")).toBe(false);
  });

  it("formats only controlled evidence labels and fails closed for unknown pointers", () => {
    expect(formatCandidateEvidence("July update / 5F plan")).toBe("7월 업데이트 · 5층 평면도");
    expect(formatCandidateEvidence("untrusted raw pointer")).toBe("원문 직접 확인");
  });

  it("fails closed instead of rendering an incomplete audit when report audit loading fails", () => {
    const reportError = "임대인 보고를 불러오지 못했습니다. 승인·발송 상태는 바뀌지 않았습니다. 다시 시도해 주세요.";
    const state = resolveAuditRecordsState(null, reportError);

    expect(state).toEqual({ status: "error", message: reportError });
    expect(state).not.toHaveProperty("reportAudit");
  });
});
