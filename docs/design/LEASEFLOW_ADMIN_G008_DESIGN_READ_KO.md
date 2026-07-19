# LeaseFlow 관리자 G008 Design Read

## 1. 판정

G008은 신규 브랜딩이나 쇼케이스 제작이 아니라, 이미 도메인과 디자인 방향이 존재하는 관리자 웹을 실제 사용자 흐름 중심으로 재구성하는 **utility CRUD/admin 개선**이다. 목표는 시각적 새로움이 아니라 검토·승인·게시의 오류 가능성을 줄이는 정보 구조, 상태 복구, 접근성, 밀도 조정이다.

- 제품 종류: 폐쇄형 B2B 운영 관리자 웹
- 핵심 업무: 원자료 등록 → 변경 근거 검토 → 역할별 승인 → 게시 → 운영 정보/임대인 보고
- 위험 수준: 높음. 잘못된 정보·파일·수신자·버전이 외부 결과에 들어가면 안 된다.
- 기준 분위기: `Quiet Evidence Ledger`
- 디자인 다이얼: variance 3/10, motion 1/10, product density D6, visual density 7/10
- 기준본: 저장소 루트 `DESIGN.md`, `EXPERIENCE.md`

## 2. 검사한 기존 시스템

### 프레임워크와 구현 방식

- `package.json`: npm workspaces. 두 번째 패키지 매니저를 사용하지 않는다.
- `apps/admin-web/package.json`: Next.js 15.4, React 19, TypeScript 기반 App Router.
- `apps/admin-web/app/layout.tsx`: 전역 `lang="ko"`, light color scheme.
- `apps/admin-web/app/globals.css`: CSS custom properties와 자체 컴포넌트 클래스. 별도 UI 프레임워크·모션 라이브러리 없음.
- `apps/admin-web/components/ui/*`: `ActionButton`, `StatusBadge`, `SectionHeading`, `FeedbackPanel`, `GovernanceSurface`, `WorkflowStep`, `DataFact`가 존재한다.

따라서 G008은 새 라이브러리나 JS 모션 의존성을 넣는 방향이 아니라 기존 CSS/token/component 표면을 정리하는 방향이어야 한다.

### 구현 전 실제 페이지 route — 역사적 감사 기록

| route | 현재 표면 | G008 해석 |
| --- | --- | --- |
| `/` | 원자료·변경 검토·게시·운영 정보·감사까지 한 페이지 | 너무 많은 업무를 한 route에 결합 |
| `/reports` | 주간 보고 생성·조사·패치·승인·기록 | 건물별 보고 상세와 목록이 분리되지 않음 |
| `/mobile-preview` | 모바일 외부 패키지 데모 검증 | 관리자 전역 IA 밖의 데모 route |
| `/design-showcase` | UI 구성요소 개발 참조 | 제품 전역 IA 밖의 개발 route |

구현 전 `AppNavigation`의 8개 메뉴 중 다수가 `/` 또는 `/reports`의 앵커였다. 이는 페이지가 아닌 구역을 전역 목적지처럼 보이게 하며, 브라우저 뒤로 가기·route focus·권한별 페이지 경계를 약화했다. 이 표와 진단은 G008 이전 상태를 보존한 감사 기록이다.

### 현재 구현된 route

| 범위 | route | 현재 역할 |
| --- | --- | --- |
| 7개 전역 업무 | `/`, `/sources`, `/changes`, `/publishing`, `/operations`, `/reports`, `/settings` | 실제 route 기반 전역 IA |
| 원자료 | `/sources/new`, `/sources/[sourceRef]` | 합성 자료 등록 범위 안내, 원자료 상세·검토 |
| 변경·게시 | `/changes/[batchRef]`, `/publishing/[batchRef]` | 데이터 담당자 1차 확인, 선임 검토자 승인·게시 |
| 운영 정보 | `/operations/versions`, `/operations/files` | 현재·이전 버전과 파일 이력 |
| 보고 | `/reports/[reportRef]` | 게시 정보 기반 건물별 외부 보고 |
| 설정·기록 | `/settings/access`, `/settings/audit` | 임대 관리 책임자용 권한·감사 기록 |

`/sources/new`는 저장소에 포함된 합성 예시 자료만 사용하는 범위와 다음 검토 단계를 설명한다. 실제 파일 업로드, 외부 문서 저장소, 회사 시스템 연동은 제공하거나 주장하지 않는다. `/mobile-preview`와 `/design-showcase`는 각각 데모·개발 route로 전역 관리자 IA 밖에 둔다.

G008 완료 당시 역사적 기준선은 전체 146/146 tests와 responsive 105/105였다. G009 이후 현재 구현은 Admin 78/78, 전체 147/147 tests, 5/5 workspace typecheck, Admin production build 24 pages와 final 14-route viewport smoke를 통과했고 console error, HTTP failure, horizontal overflow는 모두 0이다. `/settings/audit`의 보고 endpoint가 실패하면 모든 부분 감사 기록을 숨기고 안전한 재시도만 표시하며, 성공한 재시도 뒤 전체 기록을 복원한다. 최종 code review는 APPROVE, architect review는 CLEAR이며 품질 판정은 `artifacts/visual-qa/g008/G008_FINAL_QA.md`가 소유한다.

### 구현 전 시각·상호작용 패턴 — 역사적 감사 기록

보존할 기반:

- warm neutral canvas, ink navy rail, restrained blue action.
- 변경 전/후 비교, 결정 레일, 상태와 사람 승인의 분리.
- 44px control floor, `focus-visible`, reduced motion, forced colors 일부 대응.
- 사용자용 한국어 상태 mapper가 일부 존재함.

구현 전 교정 대상으로 확인한 부채:

- `Georgia` 브랜드 글꼴이 refined grotesk 단일 계열 계약과 충돌한다.
- 24–28px보다 큰 hero형 제목과 상단 KPI 유사 요약이 작업 시작점을 밀어낸다.
- `/` 한 페이지가 8943px 수준으로 길어져 route별 목적과 복구 지점이 불분명하다.
- 원자료를 반복 카드로 보여주고, 실제 원문이 아닌 CSS 가짜 평면도를 그린다.
- 작은 화면에서 전역 nav를 가로 스크롤하도록 만든다.
- 같은 페이지에 미래 단계 버튼을 비활성 상태로 나열하고 데모 역할 전환을 결정 레일에 둔다.
- 근거가 명확하지 않은 confidence 백분율, 객체 JSON fallback, 내부 상태와 ID가 사용자 표면으로 새어 나갈 경로가 있다.
- heading ID와 section ID를 같은 문자열로 중복 부여할 위험이 있다.
- navy rail의 기존 focus 조합 중 2.20:1 수준의 비텍스트 대비 위험이 보고되었으며, G008은 3:1 이상을 명시한다.

## 3. 페이지 종류와 읽기 문법

### A. Queue page

대상: 오늘의 업무, 변경 검토 목록, 승인 대기, 임대인 보고 목록.

- h1 하나.
- 검색·필터 다음에 dense task queue.
- 상태, 건물/자료, 마감, 다음 인계만 행에 표시.
- 행 선택은 실제 상세 route로 이동.
- KPI 카드, hero, 카드 그리드 없음.

### B. Registry page

대상: 원자료, 운영 정보, 버전·파일 이력, 감사 기록.

- dense table/list + detail.
- 정렬·필터·선택 상태를 URL에 유지.
- desktop table, mobile semantic `dl` row.
- 원자료별 독립 카드 벽 없음.

### C. Review page

대상: 변경 묶음 상세, 승인 상세, 보고 패치 검토.

- `task context → evidence/comparison → decision rail`.
- h2는 `근거와 비교`, `결정` 같은 실제 업무 단위.
- 현재 단계의 primary action 하나.
- 미래 단계는 읽기 전용 인계 상태.

### D. Configuration page

대상: 수신자 그룹, 접근 권한.

- 설정·기록 전역 도메인 아래 실제 nested route 로컬 nav.
- 목록 + 상세/편집 패널.
- 권한과 위험 수준에 따라 read-only 또는 편집 가능.

### E. Record page

대상: 감사, 발송, 게시·버전 이력.

- append-only 읽기 경험.
- 사람이 읽는 사건명, 역할, `ko-KR` 시간.
- raw event key, actor ID, revision, API payload 없음.

## 4. 분위기와 시각 방향

`Quiet Evidence Ledger`는 다음 느낌을 목표로 한다.

- 차분하지만 느슨하지 않다.
- 고밀도지만 시끄럽지 않다.
- 기업용이지만 개발자 콘솔처럼 보이지 않는다.
- 부동산 업무지만 지도·건물 사진·청록색 대시보드 관습을 따르지 않는다.
- 프리미엄을 serif나 큰 여백으로 연출하지 않고 정렬, 경계, 정확한 타입 계층으로 만든다.

팔레트는 warm paper + ink rail + single cobalt accent + semantic state로 제한한다. 타입은 Pretendard Variable refined grotesk 단일 계열이며 H1은 24–28px다. 깊이는 border/surface hierarchy로 만들고 그림자는 dropdown/dialog에만 절제해 쓴다.

기억점은 `증거선`: 대기열에서 선택한 작업과 근거·비교·결정의 같은 정렬축을 코발트 2px 선으로 연결한다. 이는 장식이 아니라 현재 판단 범위를 보여주는 내비게이션 보조다.

## 5. 개선 모드: keep / change / remove

| 모드 | 대상 | 이유 |
| --- | --- | --- |
| Keep | 도메인 상태기계, 권한, 게시·버전·감사 규칙 | 제품 안전 경계 |
| Keep | warm neutral, ink rail, cobalt action | 기존 방향과 G008 일치 |
| Keep | before/after 비교와 human decision rail | 핵심 업무 문법 |
| Keep | 44px, focus-visible, reduced motion, forced colors 기초 | 접근성 기반 |
| Change | 8개 anchor형 전역 메뉴 → 7개 실제 업무 route | 실제 사용자 흐름·route 복구 |
| Change | 8943px 단일 페이지 → queue/list/detail/review route | 위치 기억과 목적 분리 |
| Change | 원자료 카드 벽 → dense table/list + detail | D6 밀도와 비교 효율 |
| Change | 큰 hero 제목 → 24–28px 작업 h1 | 업무 시작점 회복 |
| Change | 여러 단계 버튼 → 현재 primary 하나 + 인계 상태 | 오류와 역할 혼동 방지 |
| Change | 역할 선택 → 별도 데모 도구 | 업무 권한과 데모 조작 분리 |
| Remove | Georgia·display serif | refined grotesk 단일 계열 위반 |
| Remove | CSS 가짜 평면도·가짜 스태킹 플랜 | 존재하지 않는 증거 암시 |
| Remove | KPI theater·marketing hero | 운영 판단과 무관 |
| Remove | gradients·glass·nested cards | 표면 계층 혼란 |
| Remove | raw enum/JSON/API 오류/ID/영문 fallback/confidence % | 사용자 언어와 안전성 위반 |
| Remove | 작은 화면 전역 nav 가로 스크롤 | 탐색 누락·200% overflow |

## 6. 도구·추천 판정

### ima2

ima2 컨셉 이미지 생성은 **'기존 LeaseFlow 디자인 시스템이 있고 이번 작업이 utility CRUD/admin 개선이므로 스킬 규칙에 따라 생략'**을 정확히 기록한다. G008은 기존 디자인 시스템의 구조적 개선이며, 새로운 컨셉 이미지가 실제 route·상태·접근성 판단을 더 정확하게 만들지 않는다.

### ui-ux-pro-max

자동 추천의 Dark OLED, Cinzel, Josefin, teal 조합은 다음 이유로 기각한다.

- Dark OLED는 긴 한국어 검토와 종이 기반 증거 대장 분위기에 맞지 않는다.
- Cinzel/Josefin은 한국어 본문과 데이터 표를 단일 계열로 운영할 수 없다.
- teal은 일반 부동산 SaaS 문법과 겹치며 LeaseFlow의 단일 cobalt 행동 의미를 흐린다.

접근성·상호작용 체크만 채택한다: 44px target, visible focus, semantic landmarks, reduced motion, forced colors, error recovery, responsive overflow, keyboard route focus.

## 7. Do / Don't

| Do | Don't |
| --- | --- |
| 실제 route를 가진 7개 전역 업무 도메인 | 같은 페이지 앵커를 독립 메뉴처럼 표시 |
| 전역 nav와 nested route local nav 분리 | 전역 메뉴와 탭을 같은 막대에 혼합 |
| queue → evidence/comparison → decision rail | hero → KPI → card wall |
| dense table/list + selected detail | 원자료마다 큰 카드와 동일 메타 반복 |
| 현재 단계 primary action 하나 | 미래 단계의 비활성 버튼 나열 |
| 역할 인계 상태와 권한 이유 | 데모 역할 전환을 업무 행동 옆에 배치 |
| 실제 문서 미리보기 또는 미지원 상태 | CSS로 꾸민 가짜 평면도 |
| 사람용 한국어 mapper와 `ko-KR` Intl | raw enum, JSON dump, 영어 fallback |
| 원인·영향·복구가 있는 오류 | 기술 오류 문자열과 `다시 시도`만 |
| 320/375 및 200%에서 한 방향 스크롤 | 전역 nav horizontal scroll, 2D content scroll |

## 8. 수용 기준

- 각 전역·로컬 메뉴가 실제 route로 직접 진입된다.
- 페이지마다 h1 하나, 업무별 h2, 항목별 h3이며 ID가 중복되지 않는다.
- 모든 review page가 task context → evidence/comparison → decision rail 순서를 따른다.
- 현재 단계에 primary action이 하나만 있고 미래 단계는 인계 상태다.
- 데모 역할 전환·초기화가 업무 컨트롤과 다른 landmark에 있다.
- raw enum, JSON, API 오류, 내부 ID, 영문 fallback, 근거 없는 confidence가 보이지 않는다.
- 10개 상태가 원인·영향·복구 계약을 충족한다.
- 320/375/768/1024/1280 및 200%에서 전역 nav 가로 스크롤과 본문 2차원 스크롤이 없다.
- keyboard focus, skip target, route focus, forced colors, reduced motion이 검증된다.
