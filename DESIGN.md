---
name: LeaseFlow Quiet Evidence Ledger
description: 출처가 있는 임대 운영 정보를 사람이 검토·승인·게시하는 고밀도 관리자 경험의 시각 기준본
status: final
updated: 2026-07-19
sources:
  - docs/PRODUCT_DIRECTION.md
  - docs/WORKFLOWS.md
  - docs/DATA_GOVERNANCE.md
  - docs/design/LEASEFLOW_SERVICE_LAYER_AND_DESIGN_MANIFEST_v3.0.0_KO.md
  - docs/design/LEASEFLOW_ADMIN_G008_DESIGN_READ_KO.md
colors:
  canvas: '#F3F5F7'
  canvas-deep: '#E7EBF0'
  surface: '#FFFFFF'
  surface-subtle: '#EEF1F5'
  surface-disabled: '#E4E8ED'
  ink: '#17212B'
  ink-secondary: '#687483'
  ink-disabled: '#8994A1'
  rail: '#16202A'
  rail-text: '#F3F5F7'
  rail-muted: '#AAB5C1'
  cobalt: '#355F9C'
  cobalt-pressed: '#284A7C'
  cobalt-wash: '#E8EEF7'
  focus-on-light: '#355F9C'
  focus-on-rail: '#93C5FD'
  border-subtle: '#D8DEE6'
  border-default: '#BEC7D2'
  border-strong: '#7B8794'
  success: '#2F6B55'
  success-wash: '#E8F2EC'
  warning: '#946A26'
  warning-wash: '#F8EDD8'
  error: '#A73535'
  error-wash: '#F8E7E5'
  info: '#355F9C'
  info-wash: '#E7EFF5'
typography:
  page-title:
    fontFamily: 'Pretendard Variable, Pretendard, sans-serif'
    fontSize: 'clamp(24px, 2.2vw, 28px)'
    fontWeight: '680'
    lineHeight: '1.25'
    letterSpacing: '-0.02em'
  section-title:
    fontFamily: 'Pretendard Variable, Pretendard, sans-serif'
    fontSize: '20px'
    fontWeight: '650'
    lineHeight: '1.35'
    letterSpacing: '-0.01em'
  item-title:
    fontFamily: 'Pretendard Variable, Pretendard, sans-serif'
    fontSize: '15px'
    fontWeight: '650'
    lineHeight: '1.45'
  body:
    fontFamily: 'Pretendard Variable, Pretendard, sans-serif'
    fontSize: '15px'
    fontWeight: '430'
    lineHeight: '1.6'
  label:
    fontFamily: 'Pretendard Variable, Pretendard, sans-serif'
    fontSize: '13px'
    fontWeight: '600'
    lineHeight: '1.45'
  data:
    fontFamily: 'Pretendard Variable, Pretendard, sans-serif'
    fontSize: '14px'
    fontWeight: '480'
    lineHeight: '1.5'
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  '12': 48px
  content-gutter-desktop: 32px
  content-gutter-tablet: 24px
  content-gutter-mobile: 16px
components:
  primary-action:
    background: '{colors.cobalt}'
    foreground: '#FFFFFF'
    pressed: '{colors.cobalt-pressed}'
    radius: '{rounded.md}'
    minHeight: 44px
  secondary-action:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.border-default}'
    radius: '{rounded.md}'
    minHeight: 44px
  work-surface:
    background: '{colors.surface}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
  evidence-row:
    background: '{colors.surface}'
    divider: '{colors.border-subtle}'
    selected: '{colors.cobalt-wash}'
  decision-rail:
    background: '{colors.surface}'
    border: '{colors.border-default}'
    radius: '{rounded.lg}'
  global-rail:
    background: '{colors.rail}'
    foreground: '{colors.rail-text}'
    muted: '{colors.rail-muted}'
    focus: '{colors.focus-on-rail}'
---

# LeaseFlow 디자인 기준본

`DESIGN.md`는 LeaseFlow 관리자 웹이 **어떻게 보여야 하는지**를 정의한다. 정보 구조, 행동, 상태, 접근성, 사용자 여정은 `EXPERIENCE.md`가 소유한다. 두 문서와 목업이 충돌하면 이 문서와 `EXPERIENCE.md`가 우선하며, 도메인·권한·게시 불변식은 `docs/DATA_GOVERNANCE.md`와 코드가 우선한다.

G008 설계 자료의 anchor형 IA·장문 페이지 진단과 77/77·146/146 검증치는 구현 당시의 역사적 감사 기록이다.

현재 구현은 `/`, `/sources`, `/changes`, `/publishing`, `/operations`, `/reports`, `/settings`의 7개 전역 route와 관련 로컬·상세 route에 이 기준을 적용한다. G009 이후 현재 최종 품질 판정은 `artifacts/visual-qa/g008/G008_FINAL_QA.md`가 소유한다.

## Brand & Style

LeaseFlow의 시각 명제는 **Quiet Evidence Ledger / 조용한 증거 대장**이다. 이 제품은 부동산 홍보물이나 KPI 대시보드가 아니라, 출처가 있는 변화가 사람의 판단을 거쳐 공식 운영 정보가 되는 고위험 반복 업무 도구다. 화면은 사용자의 시선을 장식으로 끌지 않고 `업무 대기열 → 근거와 비교 → 결정`의 순서로 이동시킨다.

디자인 다이얼은 다음 값으로 고정한다.

| 다이얼 | 값 | 이유 |
| --- | ---: | --- |
| 구성 변이 | 3/10 | 페이지 종류가 달라도 반복 업무의 위치 기억을 보존한다. |
| 모션 | 1/10 | 주의 환기보다 판단 안정성과 멀미 방지가 중요하다. |
| 제품 밀도 | D6 | 표, 변경 전후, 출처, 결정 상태를 한 화면에서 교차 검토해야 한다. |
| 시각 밀도 | 7/10 | 고밀도이되 구분선·행 간격·타입 계층으로 읽을 수 있어야 한다. |

가장 기억에 남는 요소는 장식이 아니라 **증거선**이다. 선택한 대기열 항목과 근거 행, 비교 결과, 결정 레일을 2px 코발트 선과 같은 정렬축으로 연결한다. 선은 선택된 한 작업에만 나타나며, 프로세스 전체를 장식하지 않는다.

## Colors

색은 역할이 하나씩만 있다.

- `{colors.canvas}`는 차가운 중립 회색 작업 바탕이다. 표면과 구분선을 또렷하게 나누되 질감 이미지나 노이즈를 넣지 않는다.
- `{colors.rail}`은 전역 탐색 전용 잉크 레일이다. 본문이나 모달을 어둡게 만드는 다크 테마로 확장하지 않는다.
- `{colors.cobalt}`는 현재 선택, 링크, 포커스, 현재 단계의 유일한 주 행동에만 사용한다. 넓은 장식 면이나 KPI 강조색으로 사용하지 않는다.
- `{colors.success}`, `{colors.warning}`, `{colors.error}`, `{colors.info}`는 의미 상태에만 사용한다. 모든 상태에는 텍스트 또는 아이콘 라벨을 함께 둔다.
- 중립 계층은 `{colors.border-subtle}` → `{colors.border-default}` → `{colors.border-strong}`과 `{colors.surface-subtle}` → `{colors.surface}`의 조합으로 만든다.

검증 기준: 흰 글자와 `{colors.cobalt}`는 6.43:1, `{colors.focus-on-rail}`과 `{colors.rail}`은 9.14:1, `{colors.rail-text}`와 `{colors.rail}`은 15.08:1이다. 포커스 표시와 비텍스트 경계는 인접색 대비 3:1 이상이어야 한다.

금지: 그라디언트, 글래스 블러, 네온, 보라색 AI 팔레트, 부동산 관습형 청록색, 장식용 상태색, 대형 색면 KPI.

## Typography

전 화면은 하나의 refined grotesk 계열인 **Pretendard Variable**을 사용한다. 한국어와 숫자의 폭이 안정적이고, 고밀도 표에서 제목·본문·데이터를 굵기와 크기로만 분리할 수 있기 때문이다. Georgia, Cinzel, Josefin, display serif, 별도 monospace 표현은 사용자 화면에서 제거한다.

- 페이지마다 `h1`은 하나이며 `{typography.page-title}`을 쓴다. 크기는 24–28px 범위를 넘지 않는다.
- 업무 구역 제목은 `h2`와 `{typography.section-title}`, 항목 제목은 `h3`와 `{typography.item-title}`을 쓴다.
- 시각 크기를 위해 헤딩 레벨을 건너뛰지 않는다. 작은 시각 제목이 필요하면 헤딩 레벨은 유지하고 토큰만 적용한다.
- 숫자와 날짜는 같은 글꼴의 tabular numerals를 사용한다. 사용자 화면에 코드 글꼴로 내부성을 암시하지 않는다.
- 영문 대문자 eyebrow, 숫자 접두 레이블, 과도한 자간은 쓰지 않는다. 한글 문장형 레이블을 사용한다.

## Layout & Spacing

기본 단위는 4px이며 주요 간격은 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px이다. 페이지의 공통 읽기 구조는 다음 세 영역이다.

1. **Task queue** — 현재 처리할 작업을 행 중심으로 보여준다.
2. **Evidence/comparison** — 원문, 출처, 현재값, 제안값을 같은 정렬축에서 비교한다.
3. **Decision rail** — 현재 단계의 한 가지 주 행동, 인계 상태, 차단 원인과 복구를 둔다.

`≥1024px`에서는 `{components.global-rail}`을 232px 고정 열로 두고 본문을 `minmax(0, 1fr)`로 제한한다. 작업 본문은 필요에 따라 대기열 240–280px, 증거 영역 유동폭, 결정 레일 288–320px의 3열을 사용한다. `768–1023px`에서는 compact topbar와 drawer, 본문 1열 및 필요 시 우측 drawer형 결정 레일을 쓴다. `<768px`에서는 appbar와 drawer, 한 열 흐름을 사용한다. 전역 탐색은 어떤 폭에서도 가로 스크롤하지 않는다.

320px와 375px에서 콘텐츠가 뷰포트 폭을 넘지 않아야 한다. 200% 확대에서 본문은 한 방향으로만 스크롤해야 하며, 넓은 표는 열 우선순위를 줄인 행 목록 또는 정의 목록으로 전환한다. 2차원 스크롤을 정상 동작으로 간주하지 않는다.

원자료는 dense table/list + detail 구조를 사용한다. 목록 행이 선택되면 상세 근거가 옆 또는 아래에 열리며, 파일마다 독립 카드가 반복되는 카드 벽을 만들지 않는다.

## Elevation & Depth

깊이는 그림자가 아니라 표면과 경계로 표현한다.

- 기본 페이지: `{colors.canvas}`.
- 주 작업대: `{colors.surface}` + 1px `{colors.border-subtle}`.
- 선택된 행: `{colors.cobalt-wash}` + 증거선.
- 결정 레일: 1px `{colors.border-default}`로 작업대보다 한 단계 강한 경계.
- 드롭다운·모달만 `0 8px 24px rgba(19, 43, 58, .12)` 이하의 단일 그림자를 허용한다.

작업 패널, 행, 섹션에 그림자를 누적하지 않는다. 중첩 카드와 이중 베젤을 금지한다.

## Shapes

4 / 6 / 8px의 작은 반경을 사용해 정밀한 업무 도구의 성격을 유지한다. 버튼과 입력은 `{rounded.md}`, 주 작업대와 결정 레일은 `{rounded.lg}`를 쓴다. 완전한 pill은 짧은 상태 배지에만 허용한다. 아바타, 장식 원, 큰 둥근 카드로 위계를 만들지 않는다.

## Components

### Global rail / compact topbar / appbar

- 전역 메뉴는 실제 페이지 경로가 존재하는 항목만 보여준다.
- 현재 위치는 색, `aria-current="page"`, 왼쪽 2px 표식으로 함께 표현한다.
- 데모 역할 전환기는 전역 레일 하단의 별도 “데모 도구” 영역 또는 개발 전용 패널에 둔다. 업무 결정 레일 안에 두지 않는다.
- navy rail의 키보드 포커스는 `{colors.focus-on-rail}` 2px 외곽선과 3px 간격을 사용한다.

### Task queue

- 표제, 건물/자료, 마감 또는 업데이트 시각, 사용자용 상태, 다음 인계 대상만 한 행에 둔다.
- 행 전체가 단일 상세 링크다. 체크박스, 메뉴, 추가 버튼을 한 행에 겹치지 않는다.
- 선택 행 하나만 `{colors.cobalt-wash}`와 증거선을 가진다.
- 완료 건수나 KPI를 카드로 반복하지 않는다.

### Evidence list and comparison

- 원자료 목록은 `table`, 상세 사실은 `dl`, 출처 목록은 `ul`, 단계는 `ol`을 기본으로 한다.
- 변경 비교는 `현재 정보`와 `제안 정보`를 같은 행에 정렬하고, 값만으로 의미가 달라지지 않도록 항목명을 반복한다.
- 출처 위치는 사람이 이해할 수 있는 파일명·페이지·표/구역으로 표현한다. 내부 식별자는 기본 화면에서 숨긴다.
- 근거 없는 백분율은 표시하지 않는다. 검증 가능한 근거가 있으면 `출처 2곳에서 확인`, `원문 직접 확인 필요`처럼 행동 가능한 품질 라벨을 쓴다.

### Decision rail

- 현재 상태, 차단 원인, 영향, 복구 행동, 한 개의 주 행동 순서로 구성한다.
- 같은 단계에서 primary 버튼은 하나만 존재한다. 거절·보완 요청은 secondary 또는 text action이다.
- 미래 단계는 비활성 버튼 묶음이 아니라 `다음: 선임 승인 대기` 같은 읽기 전용 인계 상태로 표현한다.
- 하나의 mutation 중에는 관련 작업 영역 전체를 `aria-busy="true"`로 두고 중복 제출을 막는다. 레이블 폭은 유지한다.

### Dense registry

- 기본은 행 밀도 48px 이상, 헤더 고정, 검색·필터·정렬, 선택 상세다.
- 모바일에서는 우선순위가 낮은 열을 숨기고, 행을 의미 있는 `dl`로 재구성한다. 데스크톱 표를 카드 모음으로 복제하지 않는다.

### Feedback and recovery

- 로딩은 실제 최종 레이아웃과 같은 skeleton 행을 사용한다.
- 오류는 `무엇이 실패했는지 → 현재 영향 → 안전한 복구`의 세 문장 이내로 쓴다.
- 재시도는 실패한 영역 안에 둔다. 성공은 결과와 다음 상태를 한 문장으로 알리고 포커스를 관련 제목으로 옮긴다.
- 감사 기록처럼 여러 endpoint를 합성하는 표면은 하나라도 실패하면 fail closed로 처리한다. 부분 기록은 숨기고 안전한 재시도만 표시하며, 재시도가 성공한 뒤에만 완전한 기록을 복원한다.
- API 메시지, 응답 본문, 내부 코드, 영어 fallback은 렌더링하지 않는다.

## Motion

CSS만 사용하며 JavaScript 모션 의존성을 추가하지 않는다.

| 순간 | 시간 | 속성 | 규칙 |
| --- | ---: | --- | --- |
| 누름 | 140ms | `transform`, `background-color` | 최대 `scale(.985)`, 필수 피드백만 |
| 상태 변화 | 180–220ms | `opacity`, `color`, `border-color` | 성공·오류·선택 변화 |
| drawer/panel | 최대 360ms | `transform`, `opacity` | 한 번에 한 패널, 배경 이동 없음 |

`prefers-reduced-motion: reduce`에서는 누름 변형, 패널 이동, 순차 등장 없이 즉시 상태를 바꾼다. 로딩 의미를 회전 아이콘에만 의존하지 않는다.

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| 대기열 → 근거/비교 → 결정 레일의 일정한 작업 문법 | 히어로 → KPI 카드 → 중첩 카드의 대시보드 문법 |
| 차가운 중립 바탕 + 잉크 레일 + 단일 코발트 | 그라디언트, 글래스, 보라색·청록색 장식 팔레트 |
| Pretendard Variable 단일 계열 | Georgia, Cinzel, Josefin, 장식 serif |
| 실제 파일 또는 명시적 “미리보기 없음” | CSS로 그린 가짜 평면도·스태킹 플랜 |
| 표/목록 + 선택 상세 | 원자료 카드 벽, 모든 항목의 독립 surface |
| h1 하나, 업무별 h2, 항목 h3 | 크기 때문에 레벨을 건너뛰거나 페이지 제목을 반복 |
| 현재 단계의 한 primary action | 미래 단계까지 비활성 버튼으로 나열 |
| 상태의 원인·영향·복구를 함께 표시 | 기술 오류, 내부 상태, 근거 없는 백분율 노출 |
| 320/375/768/1024/1280과 200%에서 한 방향 스크롤 | 작은 화면의 전역 메뉴 가로 스크롤 |
