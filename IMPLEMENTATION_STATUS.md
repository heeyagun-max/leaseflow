# Implementation Status

Update only after tests or manual verification.

| Stage | Status | Acceptance | Evidence |
|---|---|---|---|
| 0. Repository validation | Complete | `npm run validate` checks required files and JSON | `npm ci` and `npm run validate` passed on 2026-07-18 |
| 1. Domain governance | Complete | active published version, file guard, role guard, recipient tests pass | 10 domain tests pass; publication targets exact confirmed version IDs; stale plan v1 is blocked |
| 2. Admin source-to-publish | Complete | synthetic source produces candidates and senior publication updates mobile-visible data | 12 Admin tests, strict workspace typecheck, and Next production build pass; manual flow verified 300/3/3/v1 → junior 403 → senior publish → 200/2/2/v2, persistence restart, monotonic reset, and non-demo 404 boundaries |
| 3. Mobile request-to-package | Complete | request extraction, current data lookup, attachment guard, draft, approval, sandbox send | Strict call/email extraction creates candidates in schema-v2 persistent operations state; deterministic lookup uses current published 200/2/2/v2 and blocks stale v1; configured building access and recipients, protected tone-only edit, full human review, LM Manager approval, idempotent sandbox send/activity, curated mobile DTO, and Expo/Admin preview verified |
| 4. Weekly landlord report | Complete | app + mock Outlook activity, external-only report, scoped Korean command patch | Persistent schema-v3 report state; five allowlisted Korean investigations; strict Zod/source/building validation; scoped accept/reject; configured To/Cc; LM Manager approval; exactly-once sandbox delivery/activity; stale source/recipient/material blocking; curated Mobile adapter; workflow-first Mobile queue advances to the next unfinished decision; responsive Admin/Mobile workspaces verified at 375/768/1280 |
| 5. UI and deployment | Complete | judge can launch both credential-free surfaces, identify the demo boundary and active role, and reset revision-gated demo state from the CLI or either UI | `npm run demo:admin` serves Admin at `http://localhost:3000`; `npm run demo:mobile` serves Mobile Web at `http://localhost:8081`; Korean role/demo/sandbox labels, revision-aware reset, and provider-neutral container configuration are present; actual-browser QA passed at 320/375/768/1280 with reset and CORS success and zero console errors; 125 tests, all five workspace typechecks, repository validation, the 13-route Admin production build, Expo Web export, and earlier iOS/Android exports passed. Public deployment URLs remain pending and are not claimed. |
| 6. Submission evidence | Pending | README, commits, `/feedback`, public narrated video, Devpost fields | |

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
- local demo URLs: Admin `http://localhost:3000` via `npm run demo:admin`; Mobile Web `http://localhost:8081` via `npm run demo:mobile`; public deployment URLs remain pending and are not claimed;
- test output: `npm run validate` passed; all five workspaces typechecked; 125 tests passed (reset CLI 1, Admin 57, Mobile 10, AI 9, Demo Data 11, Domain 37); the 13-route Admin production build and Expo Web export passed, and earlier iOS/Android exports passed; production HTTP happy-path, adversarial/security, persistence-restart, governed asset publication, revision-aware CLI/Admin/Mobile reset, CORS, and real-browser QA passed; Admin and Mobile were reverified at 320/375/768/1280 with zero console errors; independent code-quality and OMO design-fidelity reviews both APPROVE on 2026-07-18;
- date/time of submission draft: pending Stage 6.

## Current demo persistence boundary

Stage 5 uses an atomic, strict-Zod-validated schema-v3 JSON store for single-process local `DEMO_MODE=true` publication, governed source assets, operations, and weekly-report state. The governed asset registry is an additive schema-v3 migration in the current implementation; no schema-v4 store is claimed. Source/request extraction, source-asset classification, and report patches remain candidates until deterministic checks and the required human role accept them. Package/report sending is sandbox-only and idempotent; the mobile adapter receives curated current published projections over HTTP. Multi-instance persistence remains a later Supabase adapter task; no production document repository, Outlook, SSO, carrier, email-send, or other external-send integration is claimed.
