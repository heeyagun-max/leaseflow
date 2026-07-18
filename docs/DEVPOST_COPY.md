# Devpost Draft Copy

## Project name

LeaseFlow Copilot

## Elevator pitch

A governed AI workflow that turns changing leasing source data and team communications into broker-ready packages and landlord reports.

## What it does

LeaseFlow has two connected experiences. A restricted admin web app lets designated users review AI-extracted changes from leasing source updates and publish approved versions. A mobile operations app lets LM teams turn calls, emails, and natural-language requests into source-grounded email packages, then reuses the week's activity to prepare building-specific landlord reports.

The demo proves that a changed floor plan or marketed area cannot be treated as a static attachment. When the current 5F marketed area changes from 300 py to 200 py, the previous plan is superseded. The mobile app blocks the stale plan and uses only the newly published record.

## How GPT-5.6 is used

- extracts structured change candidates from a source update;
- extracts the request, building, fields, files, recipient, and deadline from calls/email;
- proposes source-backed weekly-report patches from LeaseFlow and mock Outlook activity.

Deterministic application code controls roles, approval state, current-version selection, external shareability, recipients, and send gating.

## How Codex is used

Codex is used to design and implement the monorepo, shared domain rules, database migration, API adapters, admin and mobile UI, synthetic fixtures, tests, deployment setup, README, and debugging. Human decisions define the product boundary, data-governance policy, demo scope, and external communication rules.

## Track

Work & Productivity

## Built with

Codex, GPT-5.6, Next.js, Expo / React Native, TypeScript, Zod, Supabase-compatible Postgres, Vitest, Playwright.
