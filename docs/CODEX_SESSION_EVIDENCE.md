# Codex Session Evidence

This document distinguishes recorded repository evidence from external submission evidence that still must be captured.

## Recorded evidence

- Primary Codex session ID: `019f7335-4b59-7e81-8131-b31800757887`
- First event-period repository commit: `62fdfea`
- Latest verified milestone commit: `b7f7e90`
- Current local verification snapshot: 126 tests (reset CLI 2, Admin 57, Mobile 10, AI 9, Demo Data 11, Domain 37), all five workspace typechecks, repository validation, the 13-route Admin production build, Expo Web export, and final Admin browser QA at 375, 768, and 1280 px with no horizontal overflow or console errors
- Local narrated video: `artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4`, 109.145 seconds, 1920×1080 avc1/H.264 + AAC, 51,723,559 bytes, SHA-256 `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`

The session ID is present in the local Codex/OMX turn log and project evidence. This confirms the identifier was recorded; it is not proof that the Codex `/feedback` UI was opened or submitted.

The local video verification report records automated seven-frame OCR confirmation of synthetic markers and zero generic secret-pattern matches, plus successful manual visual samples at 5, 30, 60, and 90 seconds. No reproducible local sensitive-identifier list was configured; the verifier supports an optional blocked-term file kept outside the repository. The MP4 is intentionally included in the local git submission package, but the package has not been pushed and the video has not been publicly hosted or uploaded.

## Event-period milestone commits

| Commit | Date (KST) | Evidence milestone |
|---|---:|---|
| `62fdfea` | 2026-07-18 12:14 | Initial hackathon repository milestone |
| `be01c6a` | 2026-07-18 13:41 | Governed source-to-publish flow |
| `ca2096c` | 2026-07-18 14:46 | Mobile request-to-package flow |
| `c935ad9` | 2026-07-18 18:03 | Verified weekly-report milestone |
| `e9080c2` | 2026-07-18 19:55 | Enterprise Admin and Mobile UI redesign |
| `7b0372c` | 2026-07-18 20:41 | Mobile next-action work queue |
| `b7f7e90` | 2026-07-19 05:11 | Judge-ready governed asset demo |

## Still required for final submission

- `[PENDING: real Codex /feedback UI capture, if required by the event]`
- `[PENDING: public or judge-accessible repository URL]`
- `[PENDING: public narrated video URL showing the session evidence]`

The submission owner must capture the real Codex UI and verify any required feedback action. Do not create a guessed feedback URL, reconstruct a screenshot, or label the session ID alone as `/feedback` completion.
