# GPT-5.6 Model Contracts

All live outputs must be strict JSON and validated with the Zod schemas in `packages/ai`.

## Source extraction

Input: minimum relevant source text and current published values.

Output:

- building and effective date;
- changed field candidates;
- previous and proposed values;
- floor/space;
- state (`confirmed`, `under_discussion`, `unverified`);
- source pointer;
- external-shareability candidate;
- confidence;
- unresolved questions.

The model cannot confirm, approve, or publish.

## Request extraction

Input: call transcript, email, message, or typed request.

Output:

- building mention and resolved ID candidate;
- floor/space;
- requested fields and files;
- recipient and organization;
- deadline;
- ambiguity list.

The model cannot provide official property facts from memory.

## Weekly report patch

Input: selected building, report period, current report, app activity, mock Outlook activity, and user command.

Output:

- source-backed findings;
- target building IDs;
- scoped operations;
- source activity IDs;
- unresolved questions.

The model proposes a patch. Deterministic code applies it only after user acceptance.
