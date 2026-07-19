# LeaseFlow 관리자 G008 Design Council Report

## 1. 종합 결론

이 문서의 Lane 1–6 확인 사항은 **G008 구현 전 상태를 평가한 역사적 감사 기록**이다. 당시 판정은 조건부 승인이었으며, anchor형 전역 IA, 8943px 장문 페이지, 카드 벽, 가짜 도면, 큰 제목, 역할/행동 혼합, 접근성 복구 결함을 교정 대상으로 식별했다. 아래의 `확인` 문단을 현재 구현의 결함 목록으로 읽지 않는다.

현재 구현은 `Quiet Evidence Ledger`와 도메인 안전 경계를 유지하면서 7개 실제 전역 route와 관련 로컬·상세 route로 재구성되었다. 역할별 허용 행동과 읽기·권한 안내, 반응형 sidebar/appbar/drawer, skip·route·dialog·mutation focus, 현지화된 loading/error/empty/success feedback도 구현되었다. `/sources/new`는 실제 업로드가 아니라 저장소의 합성 예시 자료 사용 범위를 설명하는 안내 페이지다.

통합 처방은 하나다.

```text
실제 route의 업무 대기열
→ 근거와 변경 전후 비교
→ 현재 단계의 한 결정
→ 역할 인계 또는 복구
```

기존 도메인·권한·게시·버전 불변식은 변경하지 않는다.

## 2. Lane 1 — 구조

### 확인

- 전역 메뉴 8개 중 다수가 `/` 또는 `/reports`의 앵커다. 실제 페이지 IA처럼 보이지만 독립 route가 아니다.
- `/`가 원자료, 추출, 비교, 역할, 게시, 운영 정보, 감사까지 동시에 소유한다.
- 큰 제목과 운영 요약이 현재 대기열보다 먼저 나와 사용자의 첫 판단을 늦춘다.
- raw 내부값을 번역하지 못했을 때 사용자 표면으로 떨어질 가능성이 있다.

### 결론

- 전역 IA를 오늘의 업무 / 원자료 / 변경 검토 / 승인·게시 / 운영 정보 / 임대인 보고 / 설정·기록의 7개 실제 route로 재구성한다.
- 전역 nav와 local nested route nav를 분리한다.
- page마다 h1 하나, 업무별 h2, 항목별 h3를 강제한다.
- raw enum, JSON, API 오류, 내부 ID, 영문 fallback은 exhaustive 한국어 mapper 뒤에서 차단한다.

### 수용 게이트

미구현 route·anchor를 전역 메뉴에 노출하지 않으며, 직접 URL 진입과 route 후 h1 focus가 동작해야 한다.

## 3. Lane 2 — 표면

### 확인

- `/`의 약 8943px 장문 구성은 업무 완료 지점과 뒤로 가기 복구 맥락을 흐린다.
- 원자료가 카드 벽으로 반복되어 행 비교와 검색 밀도가 낮다.
- CSS로 그린 청사진형 평면도는 실제 근거가 아닌데도 증거처럼 보인다.

### 결론

- 장문 페이지를 queue/list/detail/review route로 분리한다.
- 원자료는 dense table/list + selected detail로 바꾼다.
- 실제 파일 미리보기가 없으면 `미리보기를 제공하지 않는 형식입니다`와 직접 확인 인계를 표시한다.
- surface hierarchy는 canvas → work surface → selected evidence → decision rail 네 단계만 사용한다.

### 수용 게이트

원자료 카드 벽과 fake floorplan이 없고, 320/375/200%에서 본문 2차원 스크롤이 없어야 한다.

## 4. Lane 3 — 시각

### 확인

- warm paper, ink rail, cobalt action은 제품 성격과 맞는다.
- Georgia 브랜드 처리는 한국어 고밀도 업무와 refined grotesk 단일 계열 계약에 맞지 않는다.
- 선택 작업과 근거·결정을 이어 주는 시각 축이 약하다.

### 결론

- `Quiet Evidence Ledger`를 유지한다.
- Pretendard Variable 단일 계열, H1 24–28px, border/surface hierarchy를 쓴다.
- 2px cobalt `증거선`을 선택된 task → evidence → decision의 정렬축에만 사용한다.
- gradient, glass, Dark OLED, teal brand layer, serif display를 금지한다.

### 수용 게이트

warm paper + ink rail + single cobalt + semantic states 외 장식색이 없고, Georgia/Cinzel/Josefin 사용이 없어야 한다.

## 5. Lane 4 — 폴리시

### 확인

- 반복 정보를 surface로 감싸는 AI 카드화가 정보 위계 대신 박스 위계를 만든다.
- hero 문법과 KPI theater가 utility CRUD의 첫 업무를 아래로 민다.
- nested cards와 긴 소개 카피가 D6 제품 밀도를 훼손한다.

### 결론

- card보다 row, divider, table, `dl`, white-space를 사용한다.
- page intro는 h1과 필요 시 한 문장으로 제한한다.
- KPI는 의사결정에 직접 필요한 경우만 대기열의 filter count로 나타내고 별도 카드로 만들지 않는다.
- polish는 그림자·radius 추가가 아니라 정렬, 줄 길이, 행 간격, 상태 카피를 다듬는 작업이다.

### 수용 게이트

hero, KPI card row, nested surface가 없고, 각 페이지의 첫 viewport에 실제 업무 대기열 또는 근거가 보여야 한다.

## 6. Lane 5 — 상호작용

### 확인

- 현재 결정 레일에 여러 단계 버튼과 데모 역할 선택이 함께 있어 현재 행동과 미래 권한이 섞인다.
- 개별 버튼 busy가 같은 업무의 중복 mutation을 충분히 막지 못할 수 있다.
- 오류가 재시도 버튼만 제공하면 입력 보존·영향·충돌 복구가 불명확하다.

### 결론

- 각 단계는 primary action 하나만 가진다.
- 미래 단계는 `다음: 선임 승인 대기` 같은 역할 인계 상태다.
- 역할 전환과 초기화는 별도 DemoTools landmark다.
- 하나의 mutation은 관련 업무 영역 전체의 단일 busy 상태로 관리한다.
- loading/empty/error/retry/success/permission/read-only/stale/conflict/disabled 모두 원인·영향·복구를 가진다.
- conflict에서는 사용자 입력을 보존하고 최신 내용과 다시 비교한다. stale에서는 승인·외부 결과를 차단한다.

### 수용 게이트

단계 fixture마다 primary action이 하나 이하이고, 중복 제출·자동 승인·덮어쓰기 복구가 없어야 한다.

## 7. Lane 6 — 접근성

### 확인

- section과 heading에 같은 ID를 중복 지정할 위험이 있다.
- landmark와 route focus가 일관된 계약으로 고정되지 않았다.
- navy rail focus의 일부 조합이 2.20:1 수준으로 비텍스트 3:1 기준에 못 미칠 위험이 있다.
- 오류 후 복구 focus와 200% 확대 overflow가 완료 기준으로 충분히 고정되지 않았다.
- 작은 화면 전역 메뉴 가로 스크롤은 탐색 항목 발견성과 확대 사용성을 해친다.

### 결론

- page당 유일한 main/skip target과 ID registry를 사용한다.
- route 후 h1, 제출 오류 후 오류 요약, dialog 닫힘 후 trigger에 focus를 둔다.
- heading·skip target에 고정 header 높이 이상의 `scroll-margin`을 둔다.
- rail focus는 `#93C5FD` on `#132B3A` 조합처럼 3:1 이상을 사용한다. 현재 후보 대비는 8.12:1이다.
- `≥1024` sidebar, `768–1023` compact topbar+drawer, `<768` appbar+drawer를 사용하며 global nav 가로 스크롤을 금지한다.
- semantic `nav/main/aside/section/table/dl/ul/ol/time`, 44px target, `ko-KR` Intl, reduced motion, forced colors를 강제한다.
- 200%에서는 sticky rail을 해제하고 표를 `dl` 행으로 바꾸어 한 방향 스크롤만 허용한다.

### 수용 게이트

duplicate ID=0, focus loss=0, rail focus ≥3:1, 320/375/200% primary-content 2D overflow=0이어야 한다.

## 8. 통합 우선순위

| 우선순위 | 작업 | 이유 |
| ---: | --- | --- |
| P0 | 실제 route와 전역/local nav 분리 | 가짜 IA와 장문 페이지의 근본 원인 |
| P0 | label mapper·오류 복구·stale/conflict gate | 안전·외부 결과 보호 |
| P0 | heading/ID/landmark/focus/overflow 교정 | WCAG와 작업 지속성 |
| P1 | queue → evidence/comparison → decision rail 재구성 | 핵심 업무 효율 |
| P1 | 원자료 dense table/list + detail | 카드 벽 제거·D6 달성 |
| P1 | 한 행동·역할 인계·DemoTools 분리 | 권한 혼동과 중복 mutation 감소 |
| P2 | token·type·evidence line polish | 시각 일관성과 기억점 |

## 9. 검증 시나리오

1. 전역 7개 route와 모든 local route를 주소창에서 직접 연다.
2. keyboard로 skip → global nav → local nav → h1 → queue → evidence → decision을 이동한다.
3. 데이터 담당자와 선임 검토자 권한에서 허용 행동 수를 확인한다.
4. loading/empty/error/retry/success/permission/read-only/stale/conflict/disabled fixture를 각각 연다.
5. unknown enum/error fixture에서 raw/영문/JSON/ID가 보이지 않는지 확인한다.
6. 320, 375, 768, 1024, 1280px과 200% 확대에서 overflow를 확인한다.
7. reduced motion과 forced colors에서 선택·focus·상태 의미를 확인한다.
8. 새 평면도 게시 후 이전 파일이 외부 결과에서 차단되는지 확인한다.
9. 수신자 그룹 변경 후 기존 보고가 stale되고 새 초안 전까지 발송이 차단되는지 확인한다.

## 10. 현재 판정

`DESIGN.md`와 `EXPERIENCE.md`의 G008 구현 범위는 완료되었다. 현재 자동 검증 근거는 다음과 같다.

| 검증 | 결과 |
| --- | --- |
| Admin 테스트 | 78/78 통과 |
| 전체 테스트 | 147/147 통과 |
| workspace typecheck | 5개 모두 통과 |
| Admin production build | 24 pages 생성 |

G008 당시 320/375/768/1024/1280/1440 반응형·직접 route 진입, 200% reflow, keyboard/focus, 역할·권한, loading/error/empty/success feedback을 포함한 responsive 검증 105/105가 통과했다. 이 수치는 역사적 기준선이다. G009 이후 `/settings/audit`의 보고 endpoint 실패는 모든 부분 감사 기록을 숨기고 안전한 재시도만 제공하며, 성공한 재시도 뒤 전체 기록을 복원한다. 최종 14-route viewport smoke에서 console error, HTTP failure, horizontal overflow는 모두 0이었고, code review는 APPROVE, architect review는 CLEAR다. 권위 기록은 `artifacts/visual-qa/g008/G008_FINAL_QA.md`다.
