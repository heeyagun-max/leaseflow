# G008 관리자 웹 최종 QA

- 상태: **PASS — 구현, 자동 검증, 독립 브라우저 검증 완료**
- 실행일: 2026-07-19 (Asia/Seoul)
- 권위: 이 문서가 G008의 현재 최종 판정을 소유하며 `g008-manual-qa.md`의 구현 전·초기 실패 판정을 대체한다.

## 최종 증거

| 검증 | 결과 |
| --- | --- |
| Admin 테스트 | 78/78 통과 |
| 전체 테스트 | 147/147 통과 |
| workspace typecheck | 5/5 통과 |
| Admin production build | 24 pages 통과 |
| G008 독립 responsive·browser matrix | 105/105 통과 (역사적 기준선) |
| G009 최종 14-route viewport smoke | console error 0, HTTP failure 0, horizontal overflow 0 |
| 최종 code review | APPROVE |
| 최종 architect review | CLEAR |
| 미해결 gap | 없음 |

## 구현 판정

| 범위 | 확인된 결과 |
| --- | --- |
| 전역 IA | `/`, `/sources`, `/changes`, `/publishing`, `/operations`, `/reports`, `/settings` 7개 실제 route |
| 로컬·상세 IA | `/sources/new`, `/sources/[sourceRef]`, `/changes/[batchRef]`, `/publishing/[batchRef]`, `/operations/versions`, `/operations/files`, `/reports/[reportRef]`, `/settings/access`, `/settings/audit` |
| 역할·권한 | 데이터 담당자는 분류·1차 확인, 선임 검토자는 승인·게시, 임대 관리 책임자는 게시 운영 정보·보고를 담당하며 허용되지 않은 mutation은 노출하지 않음 |
| 합성 자료 경계 | `/sources/new`는 합성 예시 자료의 사용 범위와 다음 단계를 안내하며 실제 업로드·외부 저장소 연동을 제공하지 않음 |
| 반응형 shell | desktop sidebar, smaller appbar/drawer, 콘텐츠 한 방향 reflow |
| 접근성·focus | skip, route h1, drawer/dialog 복귀, mutation feedback focus와 visible focus |
| 상태 feedback | loading/error/empty/success/permission/read-only를 안전한 한국어 원인·영향·복구 문구로 표시 |

## 독립 브라우저 검증 범위

320/375/768/1024/1280/1440 viewport, 200% reflow, 직접 route 진입, keyboard/focus, 역할·권한, loading/error/empty/success 상태, console 오류 부재를 포함한 105개 검증이 모두 통과했다. 최종 verifier가 보고한 미해결 gap은 없다.

이 105/105는 G008 완료 당시의 역사적 브라우저 기준선이다. G009 이후 최종 14-route viewport smoke도 console error, HTTP failure, horizontal overflow가 모두 0이었다.

## G009 fail-closed 감사 기록 회귀 검증

`/settings/audit`는 보고 endpoint가 실패하면 다른 endpoint에서 이미 받은 항목을 포함해 모든 부분 감사 기록을 숨긴다. 같은 오류 영역의 안전한 `다시 시도`만 제공하며, 재시도가 성공하면 완전한 감사 기록을 복원한다. 이 동작을 추가한 뒤 Admin 78/78, 전체 147/147 tests, 5/5 workspace typecheck, 24-page production build가 통과했다. 최종 code review는 APPROVE, architect review는 CLEAR다.

## 판정 규칙

이 파일은 `g008-manual-qa.md`를 supersede한다. 이후 G008 구현이 변경되면 새 독립 증거와 함께 이 문서의 판정을 갱신해야 하며, 과거 실패 보고서를 현재 상태로 다시 해석하지 않는다.
