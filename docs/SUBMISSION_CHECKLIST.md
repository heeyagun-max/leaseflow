# Submission Checklist

Checked items have repository or local verification evidence. Unchecked items require an external account, upload, public destination, or final human action.

## Verified in the repository

- [x] Credential-free synthetic Admin demo runs at `http://localhost:3000` with `npm run demo:admin`.
- [x] Credential-free synthetic Mobile Web demo runs at `http://localhost:8081` with `npm run demo:mobile`.
- [x] `npm run demo:reset` performs a revision-aware reset while Admin is running.
- [x] Demo roles, sandbox boundary, and human approval steps are visible in both surfaces.
- [x] Runtime fixtures and the judge path use synthetic data.
- [x] 289 tests (reset CLI 2, Admin 201, Mobile 18, AI 9, Demo Data 15, Domain 44) and all five workspace typechecks passed.
- [x] Repository validation, the 32-page Admin production build, and Expo Web export passed.
- [x] Stage 5 Admin and Mobile browser QA passed at 320, 375, 768, and 1280 px; final cleanup QA checked Admin at 375, 768, and 1280 px with no horizontal overflow or console errors.
- [x] README, canonical English Devpost form answers, `Codex for Everyone` concept, three-minute English narration, and runtime boundary are documented.
- [x] Local narrated video is complete at 109.145 seconds with verified 1920×1080 avc1/H.264 + AAC tracks, 51,723,559-byte size, SHA-256 `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`, automated seven-frame OCR confirming synthetic markers and zero generic secret-pattern matches, and manual 5/30/60/90-second sample checks. No reproducible local sensitive-identifier list was configured.
- [x] The MP4 is intentionally included in the local git submission package; `.omo`, `apps/admin-web/data`, and `docs/reference` are ignored, and repository validation rejects forbidden staged paths.
- [x] Primary Codex session ID `019f7335-4b59-7e81-8131-b31800757887` is recorded.
- [x] Event-period implementation commits are recorded through `b7f7e90`.

## External submission status

- [x] Devpost project submitted to `Work & Productivity` as an individual from `Korea Republic of`.
- [x] Public repository verified: `https://github.com/heeyagun-max/leaseflow`, final submission commit `6b1e7554be92c304710c6e0de9bf78007a6a78a8` on `main`.
- [x] Public-release audit completed; private source inputs and local generated artifacts are excluded by repository rules.
- [x] Public YouTube demo verified while signed out: `https://youtu.be/e9lG8biI8GY`.
- [x] Required Codex Session ID submitted: `019f7335-4b59-7e81-8131-b31800757887`.
- [x] Devpost submission confirmed as `Submitted` at 2026-07-21 08:47:44 KST. Submission ID: `1083222`.
- [x] Deployment boundary stated honestly: no durable hosted Admin or Mobile URL is claimed for the single-process JSON demo; judges receive credential-free local instructions.
- [x] Optional live OpenAI adapter remains unclaimed; the verified judge path is deterministic, synthetic, and credential-free.
