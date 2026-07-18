# Codex Instructions

## Product boundary

Build the revised product direction:

- **Data Admin Web is inside the product.** It handles synthetic source ingestion, extraction review, senior approval, and publication.
- **Mobile Operations App is inside the product.** It uses only published, authorized, current operational records for external work.
- Both surfaces share the same domain model and audit trail.

## Non-negotiable rules

1. Communications never overwrite official property data.
2. GPT output is always a candidate, task, draft, or patch until deterministic code and the correct user role accept it.
3. Only `published`, active, authorized, and externally shareable facts/files may enter external output.
4. Floor plans, stacking plans, available areas, floors, parking, rent-free, support terms, and availability dates are versioned data.
5. A new floor-plan version can change the marketed area and space boundaries; the old plan must be blocked after publication.
6. All weekly landlord reports are external-facing and building-specific.
7. To/Cc rules come from configured recipient groups, not model invention.
8. Every external package and report requires human approval.
9. Use synthetic data only in the repository and demo.
10. Do not claim production Outlook, carrier-call, SSO, or company-system integration.

## Engineering rules

- TypeScript strict mode.
- npm workspaces; do not introduce a second package manager.
- Validate model output with Zod.
- Server-side OpenAI adapter only; no API key in browser or mobile bundles.
- Use `store: false` for Responses API calls containing demo operational content.
- Deterministic functions own authorization, publication state, version selection, recipient calculation, and send gating.
- Provide `DEMO_MODE=true` without external credentials.
- Keep `.codexignore` strict to reduce unnecessary context and credit usage.
- Run typecheck, unit tests, and the relevant end-to-end path after each milestone.
- Update `IMPLEMENTATION_STATUS.md` only after verified work.

## Build order

1. Domain rules and tests.
2. Demo data adapter and seed reset.
3. Admin source-extraction and publication vertical slice.
4. Mobile request-to-package vertical slice.
5. Weekly report and scoped natural-language patch.
6. Deployment, judge instructions, video, and Devpost copy.

Do not begin production Microsoft Graph or native carrier integrations during the hackathon.
