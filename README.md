# LeaseFlow Copilot — Team Pilot Direction + Hackathon MVP

## Product in one sentence

LeaseFlow Copilot is a governed leasing-operations system that turns source updates and daily communications into approved property records, broker-ready packages, and building-specific weekly landlord reports.

## Long-term product direction

### 1. Restricted Data Admin Web
Designated users upload and review source documents, compare changes with prior versions, approve publication, and maintain the company-owned leasing data record.

### 2. Mobile Operations App
LM managers and team members receive or enter requests from calls, email, messages, and natural-language prompts; the app queries published data, selects current attachments, drafts external email, requires approval, records activity, and prepares weekly reports.

### 3. Shared secure backend
The backend owns roles, building access, source provenance, version history, publication state, file permissions, Outlook synchronization, output packages, and audit logs.

## Hackathon MVP thesis

The MVP proves one complete governed loop:

```text
Synthetic leasing update
→ GPT-5.6 change extraction
→ junior confirmation
→ senior approval and publication
→ mobile request understanding
→ current published data and floor-plan selection
→ external email package
→ human approval and sandbox send
→ activity memory + mock Outlook
→ weekly landlord report
→ natural-language patch
→ approval
```

The MVP is submitted to the **Work & Productivity** track. It is designed for later use by a small LM team, while keeping the submission safe and testable with synthetic data.

## Why two user surfaces

The users and risk levels are different:

- Admin users handle raw source material and unpublished candidate facts.
- Mobile users handle published operational data and external communication.
- Mobile users must not silently edit or publish official source data.

## Hackathon implementation

- `apps/admin-web`: Next.js restricted-data workflow and server API
- `apps/mobile`: Expo / React Native app with a web target for judges
- `packages/domain`: deterministic governance and version-selection rules
- `packages/ai`: GPT-5.6 structured extraction and patch contracts
- `packages/demo-data`: safe synthetic fixtures
- `supabase`: target schema and RLS design

## Recommended demo accounts

- `junior@demo.leaseflow.local` — Data Steward
- `senior@demo.leaseflow.local` — Senior Reviewer
- `manager@demo.leaseflow.local` — LM Manager
- `lead@demo.leaseflow.local` — Team Lead

Demo mode can use a role switcher. Production authentication is explicitly out of scope for the hackathon.

## Runtime AI

The deployed demo must make real server-side GPT-5.6 calls for:

1. source-update extraction;
2. request extraction;
3. weekly-report patch generation.

Set the exact GPT-5.6 API model identifier available to your project in `OPENAI_MODEL`. Do not guess or hardcode an unavailable model ID. A deterministic mock mode is provided only for local development and test stability.

## Quick start after Codex scaffolds dependencies

```bash
npm install
cp .env.example .env.local
npm run validate
npm run test
npm run dev:admin
npm run dev:mobile
```

## Submission evidence

- working web-accessible admin experience;
- web-accessible mobile app or Expo web build;
- sample data and reset path;
- README explanation of Codex and GPT-5.6 roles;
- meaningful event-period commits;
- `/feedback` Codex Session ID;
- narrated YouTube demo under three minutes.
