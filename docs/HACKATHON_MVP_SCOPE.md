# Hackathon MVP Scope

## Strategy

Show the long-term architecture without attempting full enterprise deployment. The MVP is a **narrow vertical slice across both user surfaces**.

## Hero building

Synthetic `Cobalt Finance Center`:

- total typical floor: 600 py;
- previously marketed portion: 300 py;
- 100 py becomes occupied;
- current marketable portion: 200 py;
- floor plan changes from v1 to v2;
- rent-free changes from 3 months to 2 months;
- supported parking changes from 3 spaces to 2 spaces.

This scenario proves that area, floor boundaries, terms, parking, and drawings are all versioned operational data.

## Admin vertical slice

- Select or upload the synthetic July source update.
- GPT-5.6 extracts candidate changes with source references.
- Junior user confirms/corrects.
- Senior user approves and publishes.
- Published records supersede prior records.
- Old floor plan becomes unavailable for new external packages.

## Mobile vertical slice

- Import synthetic call transcript or email.
- GPT-5.6 extracts a request for the current 5F space, terms, and floor plan.
- The app queries current published records.
- It shows that 300 py / plan v1 is stale and selects 200 py / plan v2.
- It drafts an external email and attachment list.
- The manager approves a sandbox send.
- The event is stored in activity memory.

## Weekly report vertical slice

- Combine LeaseFlow activity with mock Outlook messages.
- Generate a building-specific landlord report.
- Apply one of the five Korean investigation commands.
- Display a source-backed patch and a before/after diff.
- Apply configured To/Cc recipients and require final approval.

## Submission-safe constraints

- synthetic data only;
- no real company identity or tenant;
- no production email send;
- no production Outlook access;
- no carrier-call API claim;
- no claim of company adoption.
