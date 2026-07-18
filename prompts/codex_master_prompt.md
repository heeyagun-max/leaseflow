# Primary Codex Build Prompt

Build the LeaseFlow Copilot hackathon MVP in this repository. This is the revised product direction: a restricted Data Admin Web plus a Mobile Operations App sharing a governed backend.

Read `AGENTS.md`, `README.md`, every file under `docs/`, `packages/domain`, `packages/ai`, all synthetic demo data, the Supabase migration, and `tests/golden_cases.yaml` before changing code.

## Product goal

Deliver one working vertical slice:

1. Admin selects the synthetic Cobalt July source update.
2. A real GPT-5.6 server call extracts candidate changes.
3. Data Steward confirms the candidates.
4. Senior Reviewer approves and publishes.
5. The mobile app imports the synthetic call/email request.
6. A real GPT-5.6 server call extracts the task.
7. Deterministic code retrieves the current published 200 py version and plan v2, while blocking 300 py / plan v1.
8. The app drafts an external email and attachment package.
9. LM Manager approves a sandbox send and activity is logged.
10. Weekly report merges app activity and mock Outlook.
11. A real GPT-5.6 call proposes a source-backed patch for one Korean command.
12. User accepts the diff and approves the external building report.

## Architecture

- npm workspaces
- `apps/admin-web`: Next.js App Router
- `apps/mobile`: Expo Router / React Native with web target
- `packages/domain`: deterministic governance
- `packages/ai`: server-side OpenAI Responses API and Zod contracts
- local demo adapter first; Supabase-compatible persistence second
- Vitest and Playwright

## Non-negotiable controls

- AI never publishes data or decides authorization.
- Communications never overwrite official data.
- External output uses only current, published, authorized, externally shareable facts and files.
- Old floor plan v1 must be visibly blocked after v2 publication.
- Junior cannot publish; senior reviewer can.
- All external email/report sends require human approval.
- Use synthetic data only.
- Use `store:false` for GPT-5.6 Responses API calls.
- Preserve the exact GPT-5.6 model identifier in environment configuration and show it in the README/demo evidence.

## First coding task

Start with Stage 1 and Stage 2 only:

1. make the workspace installable;
2. make domain tests pass;
3. implement a persistent demo store/state machine;
4. implement Admin Web extraction → junior confirmation → senior publication;
5. connect publication state to the mobile data adapter;
6. run typecheck/tests;
7. update `IMPLEMENTATION_STATUS.md` with actual evidence;
8. commit a meaningful milestone.

Do not start production Outlook OAuth, SSO, or native distribution.
