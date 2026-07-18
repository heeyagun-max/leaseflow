# Codex Credits and Runtime AI Boundary

Codex development credits and OpenAI API runtime billing are separate. A Codex credit does not provide or prove API model access.

## Verified submission path

The verified LeaseFlow judge path:

- runs locally without external credentials;
- uses synthetic fixtures and deterministic candidate generation;
- validates candidate payloads with Zod;
- keeps every classification, extraction, and report patch as a proposal until deterministic rules and the required user role accept it;
- records package and report delivery in a sandbox instead of sending externally.

No live external GPT call was run in the final verification environment because no API credentials were provided. Do not describe the recorded demo or test results as evidence of a live model call.

## Optional server OpenAI adapter

`packages/ai` contains a server-only OpenAI Responses API adapter designed for the GPT-5.6 model identifier available to the project. It:

- requires `OPENAI_API_KEY` and an available model identifier in `OPENAI_MODEL`;
- supports source-change extraction, request extraction, and scoped weekly-report patch proposals;
- sends `store: false`;
- validates structured output before returning a candidate;
- does not own roles, authorization, publication, version selection, recipients, or send decisions.

Never expose `OPENAI_API_KEY` in the browser or Mobile bundle. If the submission team later chooses to demonstrate this optional path, it must run all three calls with authorized server credentials and record separate evidence. Until then, keep the credential-free deterministic wording in README, Devpost, and narration.

## Codex evidence

- Primary recorded session ID: `019f7335-4b59-7e81-8131-b31800757887`
- Event-period commits: `62fdfea` through `b7f7e90`
- Latest committed milestone before the final local submission pass: `b7f7e90`
- Current local result: 126 tests (reset CLI 2, Admin 57, Mobile 10, AI 9, Demo Data 11, Domain 37), five workspace typechecks, repository validation, the 13-route Admin production build, Expo Web export, and Admin cleanup QA at 375/768/1280 with no horizontal overflow or console errors
- Local narrated artifact: `artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4`, 109.145 seconds, 1920×1080 avc1/H.264 + AAC, 51,723,559 bytes, SHA-256 `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`; automated seven-frame OCR confirmed synthetic markers and zero generic secret-pattern matches, while manual 5/30/60/90-second samples passed. No reproducible local sensitive-identifier list was configured; an optional out-of-repository blocked-term file is supported. The MP4 is intentionally included in the local git submission package but has not been pushed, publicly hosted, or uploaded

See [Codex Session Evidence](CODEX_SESSION_EVIDENCE.md) for what is recorded and what still requires a real `/feedback` UI capture.
