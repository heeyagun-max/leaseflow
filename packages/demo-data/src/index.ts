export const demoSourceUpdate = {
  buildingId: "bld-cobalt",
  buildingName: "Cobalt Finance Center",
  effectiveDate: "2026-07-18",
  changes: [
    {field:"marketed_area_py", previous:300, proposed:200, source:"July update / 5F"},
    {field:"floor_plan", previous:"CFC_5F_plan_v1.svg", proposed:"CFC_5F_plan_v2.svg", source:"July update / 5F plan"},
    {field:"rent_free_months", previous:3, proposed:2, source:"July update / incentives"},
    {field:"supported_parking_spaces", previous:3, proposed:2, source:"July update / parking"},
  ],
} as const;

export const demoRequest = {
  source: "call_transcript",
  text: "코발트 파이낸스센터 5층 최신 임대 가능 면적하고 렌트프리, 지원 주차 대수, 최신 평면도 정리해서 오늘 오후에 보내주세요.",
} as const;

export const assistantHome = {
  pendingSourceReviews: 1,
  pendingPackages: 1,
  weeklyReportsDue: 1,
  heroBuilding: "Cobalt Finance Center",
} as const;
