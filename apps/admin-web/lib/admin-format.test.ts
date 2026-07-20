import { describe, expect, it } from "vitest";
import {
  assetStatusLabels,
  formatDate,
  formatDateTime,
  formatFieldValue,
  publicationStageLabels,
  roleLabels,
  safeWorkflowError,
} from "./admin-format";

describe("admin presentation formatters", () => {
  it("maps workflow values to user-facing labels without raw fallbacks", () => {
    expect(publicationStageLabels.junior_confirmed).toBe("선임 승인 대기");
    expect(assetStatusLabels.steward_confirmed).toBe("1차 확인 완료");
    expect(roleLabels.senior_reviewer).toBe("Senior Reviewer");
    expect(formatFieldValue("marketed_area_py", 200)).toBe("200평");
    expect(formatFieldValue("marketed_area_py", "200")).toBe("표시할 수 없는 값");
  });

  it("localizes machine dates and closes invalid values safely", () => {
    expect(formatDate("2026-07-18")).toContain("2026");
    expect(formatDateTime("2026-07-18T11:06:00+09:00")).toContain("2026");
    expect(formatDate("not-a-date")).toBe("표시할 수 없는 날짜");
  });

  it("turns technical workflow failures into cause, impact, and recovery copy", () => {
    expect(safeWorkflowError(new Error("revision conflict"))).toContain("최신 내용을 불러온 뒤");
    expect(safeWorkflowError(new Error("forbidden role"))).toContain("권한이 없습니다");
    expect(safeWorkflowError(new Error("unknown"))).not.toContain("unknown");
    expect(safeWorkflowError(new Error("unknown"), "승인된 보고서")).toContain("승인된 보고서는 바뀌지 않았습니다");
  });
});
