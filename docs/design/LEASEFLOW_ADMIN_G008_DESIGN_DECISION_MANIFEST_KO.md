# LeaseFlow 관리자 G008 디자인 결정 매니페스트

## 1. 기준 결정

- 경험 명제: `Quiet Evidence Ledger`
- 반복 문법: `task queue → evidence/comparison → decision rail`
- IA: 오늘의 업무 / 원자료 / 변경 검토 / 승인·게시 / 운영 정보 / 임대인 보고 / 설정·기록
- 행동: 현재 단계의 primary action 하나. 미래 단계는 버튼이 아닌 역할 인계 상태.
- 표면: warm paper + ink rail + single cobalt accent + semantic states.
- 밀도: variance 3/10, motion 1/10, product density D6, visual density 7/10.
- 비변경 영역: 도메인 상태, 역할 권한, 게시 조건, 버전 선택, 외부 공유, 수신자 계산, 발송 게이트, 감사 기록.

## 2. Keep / Change / Remove

| 판정 | 항목 | 결정 |
| --- | --- | --- |
| Keep | 사람 검토·승인·게시 경계 | UI 재구성 후에도 같은 deterministic gate 사용 |
| Keep | warm canvas, ink rail, cobalt action | 역할을 더 엄격히 제한 |
| Keep | before/after, 출처, 감사 기록 | 각 상세 route의 핵심 증거로 유지 |
| Keep | 44px, focus-visible, reduced motion, forced colors | 검증 범위를 확대 |
| Change | 8개 anchor형 메뉴 | 7개 실제 업무 route로 재구성; 책임은 local route로 보존 |
| Change | 단일 장문 페이지 | queue/list/detail/review 페이지로 분리 |
| Change | card registry | dense table/list + selected detail |
| Change | 모든 단계 버튼 | 현재 한 행동 + 다음 인계 상태 |
| Change | 역할 선택 위치 | 별도 DemoTools landmark |
| Remove | hero/KPI theater | h1 24–28px 작업 헤더와 대기열로 대체 |
| Remove | Georgia·display serif | Pretendard Variable 단일 refined grotesk |
| Remove | fake floorplan·nested cards·glass·gradients | 실제 근거 또는 명시적 미지원 상태 |
| Remove | raw enum/JSON/API 오류/ID/영문 fallback/근거 없는 confidence | exhaustive 한국어 mapper + 안전한 복구 카피 |
| Remove | responsive horizontal global nav | compact topbar/appbar + drawer |

## 3. Route map

### 전역

| 메뉴 | route | 책임 |
| --- | --- | --- |
| 오늘의 업무 | `/` | 역할별 통합 대기열 |
| 원자료 | `/sources` | 자료 등록·목록·상세 |
| 변경 검토 | `/changes` | 근거 비교·1차 확인 |
| 승인·게시 | `/publishing` | 선임 결정·게시 |
| 운영 정보 | `/operations` | 현재 사실·파일·버전 |
| 임대인 보고 | `/reports` | 건물별 외부 보고 |
| 설정·기록 | `/settings` | 수신자·권한·감사 |

### 로컬·상세

| 도메인 | route |
| --- | --- |
| 원자료 | `/sources/new`, `/sources/[sourceRef]` |
| 변경 검토 | `/changes/[batchRef]` |
| 승인·게시 | `/publishing/[batchRef]` |
| 운영 정보 | `/operations/versions`, `/operations/files` |
| 임대인 보고 | `/reports/[reportRef]` |
| 설정·기록 | `/settings/access`, `/settings/audit` |

Route gate: 페이지 module, loading, error, permission/read-only state가 구현되기 전에는 메뉴 링크를 렌더링하지 않는다. `/mobile-preview`와 `/design-showcase`는 각각 데모·개발 route로 전역 IA에서 제외한다. 앵커는 한 페이지 안 보조 점프에만 사용한다.

현재 G008 route map은 구현되었다. G008 responsive 105/105는 역사적 기준선이며, G009 이후 현재 검증은 Admin 78/78, 전체 147/147 tests, 5/5 workspace typecheck, 24-page production build와 final 14-route viewport smoke를 통과했다. console error, HTTP failure, horizontal overflow는 모두 0이고 최종 code review는 APPROVE, architect review는 CLEAR다. `/settings/audit`는 보고 endpoint 실패 시 모든 부분 감사 기록을 숨기고 안전한 재시도만 표시하며, 성공한 재시도 뒤 전체 기록을 복원한다. `/sources/new`는 실제 업로드가 아닌 합성 예시 자료 등록 범위 안내이며, 권위 판정은 `artifacts/visual-qa/g008/G008_FINAL_QA.md`를 따른다.

## 4. Page inventory

| 종류 | 대표 route | 핵심 구성 | primary action |
| --- | --- | --- | --- |
| 업무 대기열 | `/` | 역할별 queue + 선택 요약 | 선택 업무 열기 |
| 원자료 등록부 | `/sources` | filter + dense table + detail | 자료 등록 안내 |
| 자료 등록 안내 | `/sources/new` | 합성 예시 자료의 등록 범위 + 다음 검토 단계 | 원자료 목록으로 돌아가기 |
| 원자료 상세 | `/sources/[sourceRef]` | metadata + actual preview + history | 변경 내용 찾기 |
| 변경 검토 | `/changes/[batchRef]` | evidence + before/after + rail | 1차 확인 완료 |
| 승인 상세 | `/publishing/[batchRef]` | evidence + decision rail | 승인하고 게시 |
| 운영 정보 | `/operations` | current facts/files + detail | 업무 행동 없음 |
| 버전·파일 이력 | `/operations/versions`, `/operations/files` | current/read-only history | 현재 정보 보기 |
| 보고 대기열 | `/reports` | building-specific queue | 보고 열기/만들기 중 현재 하나 |
| 보고 상세 | `/reports/[reportRef]` | document + evidence/patch + rail | 상태에 맞는 한 행동 |
| 설정·기록 | `/settings`, `/settings/access`, `/settings/audit` | local nav + list/form/record | 현재 설정의 한 저장 행동 |

모든 페이지는 h1 하나, 실제 업무 구역별 h2, 항목별 h3를 사용한다.

## 5. Critical flow

### 원자료 → 게시

```text
오늘의 업무
→ 원자료 상세
→ 변경 후보 생성
→ 데이터 담당자 근거 비교·1차 확인
→ 선임 검토 인계
→ 선임 승인·게시
→ 운영 정보의 새 현재 버전
```

게시 전 후보는 공식 정보가 아니다. 새 평면도 게시 시 기존 평면도는 외부 사용에서 차단되며 이력에는 남는다.

### 운영 정보 → 임대인 보고

```text
건물별 보고 대기열
→ 게시·활성·권한·외부 공유 가능한 현재 정보 조회
→ source-backed patch 비교
→ 사용자 반영 결정
→ 설정된 To/Cc 확인
→ 사람 승인
→ 데모 발송 기록
```

기준 정보나 수신자 그룹이 바뀌면 stale 처리하고 최신 기준으로 새 초안을 만들기 전까지 승인·발송을 차단한다.

## 6. State matrix

| 상태 | 원인 | 영향 | 복구 |
| --- | --- | --- | --- |
| loading | 최초/route 조회 | 판단 대기 | 구조 일치 skeleton, 장기화 시 다시 시도 |
| empty | 범위 내 항목 없음 | 할 일 없음 | 한 개의 생성/이동 행동 또는 없음 |
| error | 조회·저장 실패 | 결과 미반영 | 입력 보존 + 원인/영향 + 영역 내 다시 시도 |
| retry | 일시 실패 | 작업 보류 | 같은 범위의 안전한 재요청 |
| success | 명령 확정 | 다음 단계/완료 | 결과+인계 알림, 관련 heading focus |
| permission | 역할/범위 불일치 | 조회·변경 제한 | 허용 범위 표시 + 담당 역할 안내 |
| read-only | 이전 버전/완료 기록 | 수정 불가 | 현재 버전 이동 또는 인계 |
| stale | 기준 정보·수신자 변경 | 기존 외부 결과 무효 | 최신 기준으로 새 초안 |
| conflict | 선행 저장 존재 | 즉시 확정 불가 | 입력 보존 + 최신 비교 + 다시 제출 |
| disabled | 조건 미충족/busy | 현재 행동 불가 | 이유 인접 표시; 미래 행동은 인계 텍스트 |

## 7. Component inventory

| component | 책임 | 핵심 계약 |
| --- | --- | --- |
| GlobalNav | 전역 업무 route | real route only, sidebar/topbar/appbar+drawer |
| LocalNav | 동일 도메인 보기 | actual nested route, global nav와 분리 |
| TaskQueue | 처리 대기열 | dense rows, URL filter, single selected row |
| SourceRegistry | 원자료 목록 | semantic table → mobile `dl` |
| EvidenceViewer | 원문 근거 | 실제 파일 또는 명시적 미지원 |
| ComparisonList | 현재/제안 비교 | 정렬된 값, source pointer, raw data 없음 |
| DecisionRail | 현재 결정 | primary 하나, block/recovery, handoff |
| WorkflowHandoff | 미래 단계 | 역할·조건·상태의 read-only 표현 |
| StatusLabel | 사용자 상태 | exhaustive Korean mapper, color+text |
| FeedbackPanel | 상태·복구 | cause/impact/recovery, restrained live region |
| DemoTools | 역할 전환·초기화 | 업무 control과 분리 |
| AuditTimeline | append-only 기록 | human event, role, localized time |
| VersionTable | 현재·이전 이력 | current first, superseded read-only |

## 8. Token recipe

| 역할 | 토큰 | 값/참조 |
| --- | --- | --- |
| canvas | `{colors.canvas}` | `#F7F4ED` |
| main surface | `{colors.surface}` | `#FFFEFB` |
| rail | `{colors.rail}` | `#132B3A` |
| primary/focus | `{colors.cobalt}` | `#1F5FAE` |
| rail focus | `{colors.focus-on-rail}` | `#93C5FD`, rail 대비 8.12:1 |
| text | `{colors.ink}` | `#23211F` |
| subtle/default/strong border | `{colors.border-subtle/default/strong}` | surface hierarchy |
| semantic states | `{colors.success/warning/error/info}` | 의미에만 사용 |
| typography | `{typography.*}` | Pretendard Variable 단일 계열 |
| h1 | `{typography.page-title}` | 24–28px |
| radii | `{rounded.sm/md/lg}` | 4/6/8px |
| spacing | `{spacing.1}`–`{spacing.12}` | 4px 기반 |
| target | `{components.primary-action.minHeight}` | 44px |

금지 recipe: gradient, glass, dark OLED body, teal brand layer, serif display, decorative floorplan, large shadow stack.

## 9. Motion spec

| 이벤트 | 시간 | 구현 | reduced motion |
| --- | ---: | --- | --- |
| press | 140ms | CSS transform/background | transform 제거 |
| selection/state | 180–220ms | CSS opacity/color/border | 즉시 전환 |
| drawer/panel | ≤360ms | CSS transform/opacity | 이동 없이 즉시 표시 |

JS motion dependency는 사용하지 않는다. 순차 카드 등장, parallax, hero animation을 만들지 않는다.

## 10. Label and content contract

- enum/event/role/field/error는 타입별 exhaustive 한국어 mapper를 거친다.
- mapper 누락 시 raw 값을 표시하지 않고 안전한 한국어 상태를 보여주며 내부 관측에만 기록한다.
- 객체·배열을 JSON으로 fallback 렌더링하지 않는다.
- 내부 ID는 UI key/API에만 쓰고 제목·표·오류에 노출하지 않는다.
- confidence 숫자는 검증 가능한 근거가 없으면 숨긴다. `출처 N곳에서 확인`, `직접 확인 필요`처럼 행동 가능한 라벨을 쓴다.
- 날짜·숫자·단위는 `Intl` `ko-KR`.

## 11. Responsive and accessibility gates

- `≥1024`: sidebar; `768–1023`: compact topbar + drawer; `<768`: appbar + drawer.
- 전역 nav는 가로 스크롤하지 않는다.
- 320/375에서도 44px target, 한 열, primary 전체 폭.
- 200% 확대에서 본문 2D scroll 없음. 표는 우선 열 `dl`로 재구성.
- skip target, `scroll-margin`, route 후 h1 focus, drawer focus return.
- light/rail focus와 비텍스트 경계 3:1 이상.
- semantic `nav/main/aside/section/table/dl/ul/ol/time`.
- reduced motion, forced colors, keyboard-only, long Korean/English labels 검증.

## 12. Verification matrix

| 검증 | 방법 | 통과 기준 |
| --- | --- | --- |
| route 존재 | 모든 전역·로컬 URL 직접 진입 | 404와 빈 shell 없음 |
| fake nav | 전역 메뉴 href 검사 | anchor/미구현 route 없음 |
| heading | DOM outline/중복 ID 검사 | h1=1, h2/h3 순서, duplicate=0 |
| action | 단계 fixture | 현재 primary=1, 미래 button=0 |
| labels | enum/error fixture | raw/JSON/ID/English fallback=0 |
| state | 10개 상태 story/e2e | cause/impact/recovery 존재 |
| responsive | 320/375/768/1024/1280 | global nav horizontal overflow=0 |
| zoom | 200% | primary content 2D scroll=0 |
| keyboard | skip/nav/route/dialog/error | focus loss=0, visible focus |
| contrast | light+rail focus | non-text ≥3:1, text WCAG AA |
| motion/colors | media emulation | 의미 손실 없음 |
| domain | stale/permission/version fixtures | unauthorized external output=0 |

## 13. 도구 판정

- ima2: '기존 LeaseFlow 디자인 시스템이 있고 이번 작업이 utility CRUD/admin 개선이므로 스킬 규칙에 따라 생략'.
- ui-ux-pro-max: Dark OLED/Cinzel/Josefin/teal은 도메인 불일치로 기각. 접근성/상호작용 체크만 채택.
