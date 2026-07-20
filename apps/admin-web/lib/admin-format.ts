import type {
  AssetClassificationState,
  AssetConfidentiality,
  AssetDocumentCategory,
  AssetExtractionState,
  AssetLifecycleStatus,
  PublicationStage,
  PublicationStatus,
  UserRole,
} from "@leaseflow/domain";

const koDate = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" });
const koDateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });
const koNumber = new Intl.NumberFormat("ko-KR");

export function formatDate(value: string | null | undefined) {
  if (!value) return "확인되지 않음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "표시할 수 없는 날짜" : koDate.format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "확인되지 않음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "표시할 수 없는 시각" : koDateTime.format(date);
}

export function formatNumber(value: number) {
  return koNumber.format(value);
}

export function formatBytes(value: number) {
  return `${formatNumber(Math.max(1, Math.round(value / 1024)))}KB`;
}

export const roleLabels: Record<UserRole, string> = {
  data_steward: "Data Steward",
  senior_reviewer: "Senior Reviewer",
  lm_manager: "Leasing Manager",
  lm_member: "Leasing Team Member",
  team_lead: "Team Lead",
  admin: "Administrator",
};

export const publicationStageLabels: Record<PublicationStage, string> = {
  source_uploaded: "원자료 확인 필요",
  extracted_candidate: "1차 검토 필요",
  junior_confirmed: "선임 승인 대기",
  senior_approved: "게시 처리 중",
  published: "게시 완료",
};

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  candidate: "검토 필요",
  junior_confirmed: "1차 확인 완료",
  senior_approved: "선임 승인 완료",
  published: "현재 사용",
  superseded: "이전 정보",
  rejected: "사용하지 않음",
};

export const assetCategoryLabels: Record<AssetDocumentCategory, string> = {
  perspective_render: "투시도",
  building_flyer: "건물 안내자료",
  portfolio_flyer: "포트폴리오 안내자료",
  floor_plan: "평면도",
  area_workbook: "면적 관리표",
  legal_document: "법무 문서",
};

export const assetStatusLabels: Record<AssetLifecycleStatus, string> = {
  registered: "담당자 확인 대기",
  steward_confirmed: "1차 확인 완료",
  published: "현장 공유 가능",
  superseded: "이전 자료",
  duplicate: "같은 자료",
  rejected: "사용하지 않음",
};

export const confidentialityLabels: Record<AssetConfidentiality, string> = {
  internal: "사내 전용",
  restricted: "제한 자료",
  legal_restricted: "법무 제한 자료",
  public_candidate: "외부 공유 검토 가능",
};

export const classificationLabels: Record<AssetClassificationState, string> = {
  candidate: "분류 제안",
  confirmed: "분류 확인 완료",
  manual_review: "직접 분류 필요",
};

export const extractionLabels: Record<AssetExtractionState, string> = {
  not_started: "내용 확인 전",
  candidate_ready: "변경 후보 준비됨",
  unsupported: "직접 확인 필요",
  reviewed: "내용 확인 완료",
};

export const fieldLabels = {
  marketed_area_py: "임대 면적",
  floor_plan: "평면도",
  rent_free_months: "렌트프리",
  supported_parking_spaces: "지원 주차",
} as const;

export function formatFieldValue(field: keyof typeof fieldLabels, value: unknown) {
  if (field === "marketed_area_py" && typeof value === "number") return `${formatNumber(value)}평`;
  if (field === "rent_free_months" && typeof value === "number") return `${formatNumber(value)}개월`;
  if (field === "supported_parking_spaces" && typeof value === "number") return `${formatNumber(value)}대`;
  if (field === "floor_plan" && typeof value === "string") return value;
  return "표시할 수 없는 값";
}

export function assetSlug(filename: string) {
  return encodeURIComponent(filename);
}

export function safeWorkflowError(error: unknown, unchangedSubject = "공식 정보") {
  const message = error instanceof Error ? error.message : "";
  if (/revision|conflict/i.test(message)) {
    return "다른 담당자가 먼저 변경했습니다. 입력과 선택은 유지됩니다. 최신 내용을 불러온 뒤 다시 확인해 주세요.";
  }
  if (/stale/i.test(message)) {
    return "기준 정보가 변경되어 현재 작업을 확정할 수 없습니다. 최신 게시 정보를 불러온 뒤 새로 확인해 주세요.";
  }
  if (/role|allowed|permission|forbidden/i.test(message)) {
    return "현재 역할에는 이 작업 권한이 없습니다. 내용은 읽을 수 있으며 다음 담당 역할에서 계속할 수 있습니다.";
  }
  return `작업 내용을 저장하지 못했습니다. ${unchangedSubject}는 바뀌지 않았습니다. 입력을 유지한 채 다시 시도해 주세요.`;
}
