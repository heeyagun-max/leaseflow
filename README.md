# LeaseFlow Copilot

LeaseFlow Copilot turns incoming landlord source files into governed leasing records, current broker packages, and building-specific weekly reports. The verified hackathon path runs locally with synthetic data and no external credentials.

## What the demo proves

Leasing teams receive flyers, perspective images, floor plans, area workbooks, contracts, calls, and email requests. A wrong version can put the wrong area or floor plan in front of a broker. LeaseFlow separates proposal from authority:

```text
Synthetic landlord source
→ classification and change candidates
→ Data Steward confirmation
→ Senior Reviewer publication
→ current published Mobile package
→ human approval
→ sandbox delivery record
→ building-specific weekly report
```

AI may propose a classification, extraction, or patch. Deterministic code and the assigned human role decide whether it can become operational data or enter an external package. Provenance and current-version checks prevent a superseded floor plan from being reused.

## Product surfaces

### Restricted Data Admin Web

Designated users register incoming sources, review proposed classifications and changes, preserve version history, and publish approved records. The synthetic registry covers perspective renders, leasing flyers, portfolio editions, floor plans, area workbooks, and legal documents.

### Mobile Operations App

The operations view uses only current, published, active, authorized, and externally shareable records. It prepares a broker package, requires an LM Manager decision, records sandbox delivery activity, and creates a building-specific weekly report.

Both surfaces use the same deterministic governance rules and audit trail. Mobile cannot publish or silently overwrite official property data.

## Verified judge path

Prerequisites: Node.js 20+ and npm.

Install and validate once:

```bash
npm ci
npm run validate
npm test
```

Start Admin Web and its demo API:

```bash
npm run demo:admin
```

Open <http://localhost:3000>.

In a second terminal, after Admin is ready, start Expo Web:

```bash
npm run demo:mobile
```

Open <http://localhost:8081>. The command sets `EXPO_PUBLIC_LEASEFLOW_API_URL=http://localhost:3000` for the browser bundle.

Reset the synthetic workflow while Admin is running:

```bash
npm run demo:reset
```

The reset command reads the current revision before posting a revision-aware reset. Do not create a root `.env.local` for this judge path; the demo scripts set the required local values explicitly.

Follow [Judge Test Instructions](docs/JUDGE_TEST_INSTRUCTIONS.md) for the exact click path and [Local Demo and Deployment](docs/LOCAL_DEMO_AND_DEPLOYMENT.md) for runtime limitations.

## AI and Codex boundary

The verified judge path is deterministic, credential-free, and synthetic. It exercises the same candidate and Zod validation contracts without making an external model call.

`packages/ai` also contains a server-only OpenAI Responses API adapter for source extraction, request extraction, and weekly-report patch proposals. It is designed to read the GPT-5.6 model identifier available to the project from `OPENAI_MODEL`, rather than hardcoding one. The adapter reads `OPENAI_API_KEY` only on the server and sends `store: false`. No live external GPT call was run in the final verification environment because credentials were not provided; the submission must not imply otherwise.

Codex was used to implement and verify the monorepo, domain controls, Admin and Mobile experiences, synthetic fixtures, API adapters, tests, local launch path, and submission documentation. The primary recorded Codex session ID is `019f7335-4b59-7e81-8131-b31800757887`; see [Codex Session Evidence](docs/CODEX_SESSION_EVIDENCE.md).

## Repository map

- `apps/admin-web` — Next.js Admin, reporting UI, and demo API
- `apps/mobile` — Expo / React Native operations app with a web target
- `packages/domain` — deterministic roles, publication, version, authorization, and send gates
- `packages/ai` — Zod contracts, deterministic demo candidates, and optional server OpenAI adapter
- `packages/demo-data` — synthetic fixtures and reset seed
- `scripts` — repository validation and revision-aware reset
- `deploy` and `compose.demo.yaml` — provider-neutral container configuration
- `docs` — judge instructions, architecture, submission copy, and evidence

## Demo roles

- `junior@demo.leaseflow.local` — Data Steward / 데이터 담당자
- `senior@demo.leaseflow.local` — Senior Reviewer / 선임 검토자
- `manager@demo.leaseflow.local` — LM Manager / 임대 관리 책임자
- `lead@demo.leaseflow.local` — Team Lead

The role switcher is a demo control. Production authentication, SSO, and account provisioning are outside the hackathon scope.

## Verification snapshot

Current local verification on 2026-07-20, with milestone history through commit `7435e87` and the current working tree:

- 289 tests passed: reset CLI 2, Admin 201, Mobile 18, AI 9, Demo Data 15, Domain 44;
- all five npm workspaces passed strict TypeScript checks;
- repository validation passed;
- the 32-page Admin production build passed;
- Expo Web export passed; earlier iOS and Android exports also passed;
- production HTTP, revision-aware reset, CORS, and real-browser QA passed;
- the final cleanup QA checked Admin at 375, 768, and 1280 px with no horizontal overflow or browser-console errors; the Stage 5 Admin and Mobile pass covered 320, 375, 768, and 1280 px;
- the local Korean demo video is 109.145 seconds, 1920×1080 avc1/H.264 + AAC, 51,723,559 bytes, with SHA-256 `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`; automated seven-frame OCR confirmed synthetic markers and zero generic secret-pattern matches, and manual 5/30/60/90-second sample checks passed. No reproducible local sensitive-identifier list was configured; the verifier supports an optional out-of-repository blocked-term file.

See [Implementation Status](IMPLEMENTATION_STATUS.md) for milestone evidence.

The reproducible local video is [LeaseFlow_Hackathon_Demo_KO.mp4](artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4). Its [verification report](artifacts/submission/VIDEO_VERIFICATION_REPORT.md) records media and content checks. The MP4 is intentionally included in the local git submission package, but the package has not been pushed and the video has not been publicly hosted or uploaded.

## Explicit limitations

- All runtime fixtures and demo actions are synthetic.
- “Send” stores an idempotent sandbox delivery record; it does not send email.
- There is no production Outlook, Microsoft Graph, SSO, carrier-call, Supabase, document-repository, or company-system integration.
- Admin uses a single-process writable JSON demo store, not a multi-instance production datastore.
- Container files are configuration-reviewed, but were not executed in the current environment because Docker was unavailable.
- The release boundary ignores `.omo`, `apps/admin-web/data`, and `docs/reference`; repository validation rejects forbidden staged paths.
- No public deployment URL or public video URL is claimed yet. The narrated MP4 is complete locally but has not been uploaded.

## Submission fields

- Admin URL: `[PENDING: public judge URL]`
- Mobile Web URL: `[PENDING: public judge URL]`
- Repository URL: `[PENDING: public or judge-accessible repository URL]`
- Demo video URL: `[PENDING: public narrated video URL, 3:00 maximum]`
- Primary Codex session ID: `019f7335-4b59-7e81-8131-b31800757887`

The canonical English form answers, full write-up, demo narration, and `Codex for Everyone` concept are in the [OpenAI Build Week Submission Master](docs/submission/LeaseFlow_OpenAI_Build_Week_Submission_Master_EN.md). Remaining owner actions are tracked in the [Submission Checklist](docs/SUBMISSION_CHECKLIST.md).
