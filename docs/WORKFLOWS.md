# Workflows

## Workflow 1 — Source update to published data

1. Data Steward uploads/selects a source update.
2. Server sends minimum required source content to GPT-5.6.
3. GPT returns structured candidates with source pointers and confidence.
4. Deterministic code compares candidates to current published versions.
5. Junior confirms, corrects, or marks unresolved.
6. Senior approves/rejects the review batch.
7. Approved facts/files are published with effective dates and version links.
8. Prior versions are superseded but retained.
9. Audit timeline records every action.

## Workflow 2 — Mobile request to external package

1. Request arrives by call transcript, email fixture, message, or typed command.
2. GPT-5.6 extracts building, space, requested facts/files, recipient, and deadline.
3. User resolves ambiguity if needed.
4. Code retrieves only current published and externally shareable facts/files.
5. Stale plans and prior terms are visibly blocked.
6. GPT drafts the external email from retrieved facts only.
7. User issues a scoped natural-language revision.
8. User reviews recipients, sources, files, and diff.
9. Human approves sandbox send.
10. Package and activity are logged.

## Workflow 3 — Weekly landlord report

1. Scheduler or `Run now` selects report period and building.
2. Load app activity and mock Outlook activity.
3. GPT classifies changes, requests, blockers, competitor buildings, and next actions.
4. Code separates external-reportable and internal-only facts.
5. Populate configured report sections and recipient groups.
6. User runs one or more investigation commands.
7. GPT proposes a source-backed patch, not a full uncontrolled rewrite.
8. User accepts/rejects the diff.
9. Human approves the external report and cover email.
