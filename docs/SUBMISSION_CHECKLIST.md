# Submission Checklist

Checked items have repository or local verification evidence. Unchecked items require an external account, upload, public destination, or final human action.

## Verified in the repository

- [x] Credential-free synthetic Admin demo runs at `http://localhost:3000` with `npm run demo:admin`.
- [x] Credential-free synthetic Mobile Web demo runs at `http://localhost:8081` with `npm run demo:mobile`.
- [x] `npm run demo:reset` performs a revision-aware reset while Admin is running.
- [x] Demo roles, sandbox boundary, and human approval steps are visible in both surfaces.
- [x] Runtime fixtures and the judge path use synthetic data.
- [x] 126 tests (reset CLI 2, Admin 57, Mobile 10, AI 9, Demo Data 11, Domain 37) and all five workspace typechecks passed.
- [x] Repository validation, the 13-route Admin production build, and Expo Web export passed.
- [x] Stage 5 Admin and Mobile browser QA passed at 320, 375, 768, and 1280 px; final cleanup QA checked Admin at 375, 768, and 1280 px with no horizontal overflow or console errors.
- [x] README, English Devpost copy, Korean meaning check, three-minute script, and runtime boundary are documented.
- [x] Local narrated video is complete at 109.145 seconds with verified 1920×1080 avc1/H.264 + AAC tracks, 51,723,559-byte size, SHA-256 `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`, automated seven-frame OCR confirming synthetic markers and zero generic secret-pattern matches, and manual 5/30/60/90-second sample checks. No reproducible local sensitive-identifier list was configured.
- [x] The MP4 is intentionally included in the local git submission package; `.omo`, `apps/admin-web/data`, and `docs/reference` are ignored, and repository validation rejects forbidden staged paths.
- [x] Primary Codex session ID `019f7335-4b59-7e81-8131-b31800757887` is recorded.
- [x] Event-period implementation commits are recorded through `b7f7e90`.

## External actions still required

- [ ] Join or confirm the Devpost project and select `Work & Productivity`. Owner: submission owner. Action: verify the project settings in Devpost.
- [ ] Confirm the repository is judge-accessible. Owner: repository owner. Action: provide a public URL or invite the required judge accounts if it remains private.
- [ ] Complete a public-release data audit. Owner: repository owner. Action: exclude any private planning/reference materials from the judge-accessible repository or deployment; do not rely only on the synthetic runtime boundary.
- [ ] Publish and test the Admin judge URL. Owner: deployment owner. Action: replace `[PENDING: public judge URL]` only after a clean-browser smoke test.
- [ ] Publish and test the Mobile Web judge URL. Owner: deployment owner. Action: build it with the final public HTTPS Admin origin, then run a clean-browser smoke test.
- [ ] Add the final repository URL. Owner: repository owner. Action: replace `[PENDING: public or judge-accessible repository URL]` after access is verified.
- [ ] Push or otherwise publish the judge-accessible repository package. Owner: repository owner. Action: verify that the intended MP4 is included and forbidden local/reference paths are absent.
- [ ] Upload the video and verify public playback with narration. Owner: video owner. Action: replace `[PENDING: public narrated video URL, 3:00 maximum]` only after playback succeeds while signed out.
- [ ] Capture the Codex `/feedback` UI evidence required by the event, if applicable. Owner: submission owner. Action: capture the real UI and associate it with the recorded session ID; do not manufacture a feedback URL or screenshot.
- [ ] Decide whether to demonstrate the optional live OpenAI adapter. Owner: technical/submission owner. Action: if used, provide server-only credentials, set an available `OPENAI_MODEL`, run and record the three live paths, and keep `store: false`; otherwise keep the deterministic-demo wording and make no live-call claim.
- [ ] Review every final form field and replace all bracketed placeholders. Owner: submission owner. Action: search for `PENDING:` before submission.
- [ ] Save the Devpost draft and re-open it before the deadline. Owner: submission owner. Action: verify formatting, links, video playback, track, and team membership.
- [ ] Submit the final entry. Owner: submission owner. Action: confirm Devpost shows the submitted state and timestamp.
