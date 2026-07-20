# Implementation Status

Update only after tests or manual verification.

| Stage | Status | Acceptance | Evidence |
|---|---|---|---|
| 0. Repository validation | Complete | `npm run validate` checks required files and JSON | `npm ci` and `npm run validate` passed on 2026-07-18 |
| 1. Domain governance | Complete | active published version, file guard, role guard, recipient tests pass | 10 domain tests pass; publication targets exact confirmed version IDs; stale plan v1 is blocked |
| 2. Admin source-to-publish | Complete | synthetic source produces candidates and senior publication updates mobile-visible data | 12 Admin tests, strict workspace typecheck, and Next production build pass; manual flow verified 300/3/3/v1 → junior 403 → senior publish → 200/2/2/v2, persistence restart, monotonic reset, and non-demo 404 boundaries |
| 3. Mobile request-to-package | Complete | request extraction, current data lookup, attachment guard, draft, approval, sandbox send | Strict call/email extraction creates candidates in schema-v2 persistent operations state; deterministic lookup uses current published 200/2/2/v2 and blocks stale v1; configured building access and recipients, protected tone-only edit, full human review, LM Manager approval, idempotent sandbox send/activity, curated mobile DTO, and Expo/Admin preview verified |
| 4. Weekly landlord report | Complete | app + mock Outlook activity, external-only report, scoped Korean command patch | Persistent schema-v3 report state; five allowlisted Korean investigations; strict Zod/source/building validation; scoped accept/reject; configured To/Cc; LM Manager approval; exactly-once sandbox delivery/activity; stale source/recipient/material blocking; curated Mobile adapter; workflow-first Mobile queue advances to the next unfinished decision; responsive Admin/Mobile workspaces verified at 375/768/1280 |
| 5. UI and deployment | Complete | judge can launch both credential-free surfaces, identify the demo boundary and active role, and reset revision-gated demo state from the CLI or either UI | `npm run demo:admin` serves Admin; `npm run demo:mobile` serves Mobile Web. Korean role/demo/sandbox labels, revision-aware reset, and provider-neutral container configuration are present. The current workspace passes 289 tests, all five workspace typechecks, and the 32-page Admin production build. Final local runtime verification on 2026-07-20 returned HTTP 200 for Admin home, buildings, work, weekly, upload and Expo Web. Same-Wi-Fi access and a temporary external HTTPS evaluation tunnel were verified. The external tunnel completed upload → review → publish → Mobile synchronization and was reset to upload-ready revision 34. Durable Vercel deployment remains pending until the single-process JSON store is replaced with multi-instance persistence. |
| 6. Submission evidence | Complete | local narrated video, README, commits, Codex session evidence, Devpost draft, and reproducible verification report | The local Korean demo video and submission evidence were completed on 2026-07-19. `LeaseFlow_Hackathon_Demo_KO.mp4` is 109.145 seconds, 1920×1080 avc1/H.264 + AAC, 51,723,559 bytes, and has SHA-256 `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`; automated seven-frame OCR confirmed synthetic markers and zero generic secret-pattern matches, and manual 5/30/60/90-second sample checks passed. The current workspace passes 289/289 tests, 5/5 typechecks, validation, the 32-page Admin production build, Expo Web runtime, and the historical responsive/design QA. The 2026-07-20 actual-source code review returned `WATCH / APPROVE` with no in-scope blocker, and final manual QA returned `PASS`. The MP4 is intentionally included in the local git submission package but has not been pushed, publicly hosted, or uploaded. Public Admin/Mobile/Repo/Video URLs, real `/feedback` UI capture, public-release data audit, and final external submission remain pending and are not claimed. |

## 집 Wi-Fi 사용자 평가 준비 — verified 2026-07-20

- 건물 상세는 내부 확인 흐름 대신 임대인, 권역, 임대 가능 층·면적, 입주 가능일, 렌트프리, 지원 주차, 최신 반영일을 한 화면에 표시한다. 건물 목록 복귀 버튼과 현재 평면도 다운로드를 제공하며, 업로드한 원본 임대정보는 게시 완료 뒤에만 다운로드 링크를 노출한다.
- 완료된 데모 상태에서도 데이터 담당자가 `새 자료 테스트 시작`을 눌러 새 업로드를 바로 시작할 수 있다. 검증 후 이 초기 상태로 다시 준비했다.
- 집 Wi-Fi의 다른 기기에서 Admin `http://192.168.35.117:3172`와 Mobile Web `http://192.168.35.117:8081` 접속을 확인했다. Mobile은 같은 LAN Admin API를 바라보도록 실행했다.
- 실제 업로드 경로로 4개 변경을 추출하고 담당자 확인·선임 게시 후 Admin과 Mobile에 `200평 / 2개월 / 2대 / CFC_5F_plan_v2.svg`가 동일하게 표시됨을 확인했다. 원본 다운로드 파일도 등록 파일과 일치했다.
- 근거: [.omo/evidence/husband-home-evaluation-20260720/RESULT.md](.omo/evidence/husband-home-evaluation-20260720/RESULT.md). 현재 합계는 289/289 tests, 5/5 workspace typechecks, validation, 32/32 Admin build다.

## 외부 네트워크 사용자 평가 — verified 2026-07-20

- 같은 Wi-Fi가 아닌 환경을 위해 Admin과 Expo Web을 별도 HTTPS 빠른 터널로 연결했다.
- 외부 관리자 주소에서 합성 원자료를 실제 파일 선택으로 등록하고 4개 변경을 추출한 뒤 담당자 확인과 선임 게시까지 완료했다.
- 외부 모바일 주소에서 게시값 `200평 / 2개월 / 2대 / CFC_5F_plan_v2.svg`가 동일하게 반영되는 것을 확인했다.
- 자료 올리기 화면에서 합성 테스트 원자료를 바로 내려받을 수 있다. 외부 주소에서 첨부 다운로드, `no-store`, JSON 내용과 신규 route 테스트 2/2 및 Admin typecheck를 확인했다.
- 검증 후 revision 34의 자료 올리기 초기 상태로 되돌렸다. 현재 빠른 터널은 이 컴퓨터와 관련 프로세스가 실행 중일 때만 유지되며 재시작 시 주소가 바뀐다.
- 근거: [.omo/evidence/remote-evaluation-20260720/RESULT.md](.omo/evidence/remote-evaluation-20260720/RESULT.md).

## G001 실제 원자료 웹·앱 종단간 검증 — verified 2026-07-20

- 가입·로그인·권한 연결은 사용자 요청에 따라 이번 검증에서 제외했다.
- 합성 Pacific Gate 16쪽 임대 안내 PDF 회귀 픽스처는 텍스트 9,122자와 검토 항목 4개로 정리한 뒤 담당자 확인과 선임 게시를 완료했다. 게시된 결과는 공식 임대조건과 분리된 승인 참고자료로 Admin과 Expo에 동일하게 표시된다.
- 이미지 중심 Perspective PDF, DWG, 추출 한계 평면도 PDF는 자동 게시하지 않고 원문 확인으로 중단한다. 합성 법무 DOCX와 면적 XLSX는 내부 검토만 허용하며 공식정보 또는 외부 자료로 게시하지 않는다. 20MB 크기 제한은 제거했으며 합성 62MB 포트폴리오 PDF도 358쪽을 분석해 담당자 검토 단계로 등록한다. 위조·손상·빈 Office 문서와 다중 파일은 상태 변경 전에 거절한다.
- 문서 등록·검토·게시 동안 공식 네 필드 상태는 불변이었다. 합성 JSON의 사람 승인 뒤에만 Cobalt 5F 최신정보가 200평, 렌트프리 2개월, 주차 2대, `CFC_5F_plan_v2.svg`로 바뀌고 v1은 외부 사용에서 제외됐다.
- 최신정보만 사용한 고객 안내자료 1건은 sandbox 전달 기록을 완료했고, 같은 임대인의 Cobalt와 Pacific 주간보고는 건물별로 별도 생성·승인·전달 기록을 완료했다.
- 동일 파일의 같은 건물 재업로드는 기존 문서 ID와 검토 흐름을 재사용하고 파일명 이력만 합친다. 동일 파일을 다른 건물·자료종류로 재등록하면 저장 전에 거절하고 정규 상태·intake·파일을 바꾸지 않는다.
- 최종 근거: [실제 원자료 E2E 결과](.omo/evidence/ulw/leaseflow-full-e2e-20260720/G001-leaseflow/a1/E2E-RESULTS.md), [62MB 원자료 후속 검증](.omo/evidence/ulw/leaseflow-full-e2e-20260720/G001-leaseflow/a1/LARGE-SOURCE-FOLLOWUP.md), [수동 QA](.omo/evidence/ulw/leaseflow-full-e2e-20260720/G001-leaseflow/a1/final-manual-qa.md), [코드 리뷰](.omo/evidence/ulw/leaseflow-full-e2e-20260720/G001-leaseflow/a1/final-code-review.md). 현재 합계는 286/286 tests, 5/5 workspace typechecks, validation, 32/32 Admin build다.

## Unified Web IA and shared operations workflow — verified 2026-07-19

- The user-facing Web IA has four common routes for every role: `업무 홈` (`/`), `건물정보` (`/buildings`), `자료·업무` (`/work`), and `주간업무` (`/weekly`). The labels describe the user's work instead of exposing implementation status names.
- Web-only management routes are role-gated. `건물정보 업로드` (`/building-updates`) is available to Data Steward, Senior Reviewer, and Admin roles. `주간업무 설정` (`/weekly-settings`) and `설정·기록` (`/settings`) are available to LM Manager and Admin roles. Mobile does not receive these management screens.
- Web and Mobile consume one authorized operations snapshot from `/api/operations/snapshot`. The snapshot requires one canonical revision and publication stage across the current published building view, package workflow, and report workflow; scopes the result to the actor's authorized buildings; and rejects internal-only fields before projection. Mobile workflow and report reads now use this shared snapshot.
- `건물정보 업로드` accepts only the allowlisted synthetic `data/demo/source_update.json` example. Registration produces extraction candidates, Data Steward confirmation records the first human decision, and Senior Reviewer publication deterministically makes the accepted current facts and file version available to operational views. Communications cannot overwrite official building data, and no unaccepted candidate enters external output.
- `주간업무 설정` stores landlord groups with included buildings, cadence, meeting schedule, owner, approver, and five role-bearing To/Cc recipients. This saved configuration is the report authority used for building scope, draft recipients, approval, staleness checks, and delivery gating. Weekly work is grouped for preparation by landlord, while every external-facing report remains building-specific and requires the configured human approver.
- Fresh command evidence: `npm test` passed 215/215 tests (reset CLI 2, Admin 141, Mobile 13, AI 9, Demo Data 13, Domain 37); all five workspace typechecks passed; `npm run build --workspace @leaseflow/admin-web` generated 32/32 pages; repository validation and `git diff --check` passed.
- Browser evidence in the [final unified Web manual QA](artifacts/visual-qa/unified-web/G001-unified-web-manual-qa.md) exercised the unified IA at desktop 1440px and narrow 375×812, including role-filtered navigation, four truthful natural-language intents, current-only building detail, synthetic upload → review → publication, the complete request → confirmation → draft → approval → sandbox delivery-record flow, landlord-grouped multi-building weekly work, separate Cobalt and Pacific report details, saved recipient/approver settings, direct unauthorized report access, and console checks. The two building reports preserved separate facts, source material, attachments, recipients, approval, and delivery state. Visible UI inspection found no raw JSON, lifecycle codes, protected material markers, version/source implementation strings, or English internal copy. The final delivery state explicitly says that no real email was sent.
- Fresh independent final review returned `APPROVE` for code and `CLEAR` for architecture after rechecking the actor-scoped snapshot, exact-building report creation, saved authority enforcement, missing-authority blocking, mobile contract, reset rollback, and final browser evidence.
- Approved v2 visual references: [unified service IA](docs/design/visuals/leaseflow-unified-service-ia-ko-v2.png), [unified service workflow](docs/design/visuals/leaseflow-unified-service-workflow-ko-v2.png), and [Web/Mobile concept](docs/design/visuals/leaseflow-unified-web-mobile-concept-v2.png).

## G009 감사 기록 fail-closed 복구 — 구현 및 최종 검증 완료 — 2026-07-19

- `/settings/audit`에서 보고 endpoint 조회가 실패하면 감사 기록 전체를 fail closed로 숨기고, 부분적으로 조회된 감사 항목은 하나도 렌더링하지 않는다.
- 화면은 원인과 영향을 설명하는 안전한 한국어 오류 상태와 동일 영역의 `다시 시도`를 제공한다. 재시도에 성공하면 전체 감사 기록을 복원한다.
- 최종 근거: Admin 78/78, 전체 147/147 tests, 5/5 workspace typecheck, Admin production build 24 pages, final 14-route viewport smoke에서 console error 0, HTTP failure 0, horizontal overflow 0. 최종 code review는 APPROVE, architect review는 CLEAR다.
- 아래 G008 77/77·146/146·responsive 105/105 수치는 당시 완료 시점의 역사적 기준선이며 G009 이후 현재 합계가 아니다.

## G008 관리자 IA·UX 재구성 — 구현 및 독립 검증 완료 — 2026-07-19

- 7개 전역 업무 route `/`, `/sources`, `/changes`, `/publishing`, `/operations`, `/reports`, `/settings`와 로컬·상세 route `/sources/new`, `/sources/[sourceRef]`, `/changes/[batchRef]`, `/publishing/[batchRef]`, `/operations/versions`, `/operations/files`, `/reports/[reportRef]`, `/settings/access`, `/settings/audit`를 구현했다.
- 데이터 담당자는 원자료 분류와 변경 후보 1차 확인, 선임 검토자는 승인·게시, 임대 관리 책임자는 게시된 운영 정보와 건물별 보고를 담당한다. 임대 관리 책임자는 원자료를 읽을 수 있지만 분류·게시 mutation은 수행할 수 없다.
- `/sources/new`는 실제 업로드 화면이 아니라 저장소에 포함된 합성 예시 자료의 사용 범위와 다음 검토 단계를 설명하는 안내 route다. 외부 문서 저장소나 회사 시스템 연동을 제공하거나 주장하지 않는다.
- desktop sidebar와 smaller appbar/drawer, 320–1440px 및 200% reflow, skip·route·drawer/dialog·mutation feedback focus, 한국어 loading/error/empty/success/permission/read-only feedback을 구현했다.
- G008 당시 근거: Admin 77/77, 전체 146/146 tests, 5/5 workspace typecheck, Admin production build 24 pages, responsive 105/105, console error 0. 이 수치는 역사적 기준선이며, G009 이후 현재 최종 근거는 위 G009 항목과 `artifacts/visual-qa/g008/G008_FINAL_QA.md`의 최신 부록을 따른다.

## v3.0 UI·UX alignment — verified 2026-07-19

- Treated `LeaseFlow_Final_Master_Package_v3.0.0` as the upper UX contract without replacing the more complete working repository.
- Added the fixed eight-item closed Admin IA, evidence-to-decision review workbench, review checklist, and operational summary strip.
- Made the natural-language request the first functional element on Mobile and fixed the bottom navigation to `홈 / 담당 업무 / 업무 기록 / 주간 보고`.
- Removed internal implementation labels from the principal user-facing paths and kept the non-production integration boundary explicit in human language.
- Recorded the service-layer taxonomy and visual contract in `docs/design/LEASEFLOW_SERVICE_LAYER_AND_DESIGN_MANIFEST_v3.0.0_KO.md` and retained ImageGen concepts plus real-browser QA captures under `docs/design/concepts/` and `artifacts/visual-qa/`.
- Fresh evidence: all five workspaces typechecked; 117 tests passed; Admin production build passed; Expo web export passed; repository validation passed; real-browser console had zero errors; React Doctor reported zero errors and no module-scope warnings in the newly changed navigation code. Remaining static warnings are pre-existing architecture findings or scans of generated Expo bundles.

## G007 governed source asset registry — verified 2026-07-19

- Added an additive synthetic-only registry for perspective renders, building flyers, portfolio editions, floor plans, area workbooks, and legal documents without replacing the existing official fact/file workflow.
- Deterministic classification remains a candidate; Data Steward confirmation and Senior Reviewer publication are separate, audited decisions. Exact synthetic fingerprints merge observed names, filename dates remain artifact dates, restricted workbook/legal sources stay non-shareable, and DWG/DXF stays in manual review.
- External projection enforces published + active + relationship-derived current + authorized + shareable. Floor-plan publication additionally requires the matching current official file version; publishing v2 supersedes and blocks v1 while an unpublished v2 candidate never reaches Mobile; exact-building projection and the communication registry-immutability guard prevent cross-building leakage and operational overwrites.
- Fresh evidence: Domain 37/37, Demo Data 11/11, Admin 54/54; all five workspace typechecks; repository validation; Admin production build; production HTTP flow verified early v2 rejection then v1 → v2 supersession with zero restricted-source leakage; real-browser Admin registry rendered with Korean labels and zero console errors.

## Event-period evidence

Record:

- first event-period commit: `62fdfea` (initial repository milestone);
- primary Codex session ID: `019f7335-4b59-7e81-8131-b31800757887`;
- model-access test: live external call not run without credentials; injectable server adapter test proves the live Zod path and `packages/ai` uses `store: false`;
- local demo URLs: Admin `http://localhost:3000` via `npm run demo:admin`; Mobile Web `http://localhost:8081` via `npm run demo:mobile`; temporary external HTTPS evaluation URLs were verified on 2026-07-20, while durable Vercel deployment remains pending until multi-instance persistence is implemented;
- current test output: `npm run validate` passed; 289/289 tests and all 5/5 workspace typechecks passed; the 32-page Admin production build and Expo Web runtime passed. The 2026-07-20 actual-source E2E verified document ingestion, governed reference publication, current-only package material, separate building reports under landlord groups, and same-Wi-Fi husband evaluation readiness. Earlier design-refactor and G008 responsive QA remain historical milestone evidence;
- local submission artifact: `artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4`, 109.145 seconds, 1920×1080 avc1/H.264 + AAC, 51,723,559 bytes, SHA-256 `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`; automated seven-frame OCR confirmed synthetic markers and zero generic secret-pattern matches, and manual 5/30/60/90-second visual samples passed. No reproducible local sensitive-identifier list was configured; an optional out-of-repository blocked-term file is supported;
- release boundary: the MP4 is intentionally included in the local git submission package, while `.omo`, `apps/admin-web/data`, and `docs/reference` are ignored and repository validation rejects forbidden staged paths; the package has not been pushed or publicly hosted;
- date of reconciled local submission package: 2026-07-19; public links, video upload, `/feedback` UI capture, public-release data audit, and final external submission remain pending.

## Current demo persistence boundary

Stage 5 uses an atomic, strict-Zod-validated schema-v3 JSON store for single-process local `DEMO_MODE=true` publication, governed source assets, operations, and weekly-report state. The governed asset registry is an additive schema-v3 migration in the current implementation; no schema-v4 store is claimed. Source/request extraction, source-asset classification, and report patches remain candidates until deterministic checks and the required human role accept them. Package/report sending is sandbox-only and idempotent; the mobile adapter receives curated current published projections over HTTP. Multi-instance persistence remains a later Supabase adapter task; no production document repository, Outlook, SSO, carrier, email-send, or other external-send integration is claimed.
