import { describe, expect, it } from "vitest";
import {
  boundedReviewedCandidate,
  documentTerminalGuidance,
  uploadAcceptForDocumentType,
} from "./building-update-console";

describe("building update document UI", () => {
  it("changes the file picker formats with the selected document type", () => {
    const types = [
      { value: "monthly_owner_update" as const, accept: ".json,.pdf,.docx" },
      { value: "floor_plan" as const, accept: ".json,.pdf,.dwg" },
      { value: "area_workbook" as const, accept: ".json,.xlsx" },
    ];

    expect(uploadAcceptForDocumentType(types, "monthly_owner_update")).toBe(".json,.pdf,.docx");
    expect(uploadAcceptForDocumentType(types, "floor_plan")).toBe(".json,.pdf,.dwg");
    expect(uploadAcceptForDocumentType(types, "area_workbook")).toBe(".json,.xlsx");
  });

  it("bounds the extracted review copy before rendering it", () => {
    const candidate = boundedReviewedCandidate({
      summary: "요".repeat(260),
      facts: Array.from({ length: 8 }, (_, index) => ({ label: `${index}${"항".repeat(45)}`, value: "값".repeat(130) })),
    });

    expect(candidate?.summary).toHaveLength(240);
    expect(candidate?.facts).toHaveLength(6);
    expect(candidate?.facts[0]?.label.length).toBeLessThanOrEqual(40);
    expect(candidate?.facts[0]?.value.length).toBeLessThanOrEqual(120);
  });

  it("ends manual and internal-only documents with truthful English guidance", () => {
    const manual = documentTerminalGuidance({ review_policy: "manual_review", status: "registered" });
    const reviewOnly = documentTerminalGuidance({ review_policy: "review_only", status: "steward_confirmed" });

    expect(manual).toContain("Review the original manually");
    expect(manual).toContain("cannot be published");
    expect(reviewOnly).toContain("not published externally");
    expect(`${manual} ${reviewOnly}`).not.toMatch(/manual_review|review_only|publishable_reference/);
  });
});
