# Acceptance Criteria

## Admin

- GPT-5.6 source extraction returns the four expected change candidates.
- Data Steward can confirm/correct but cannot publish.
- Senior Reviewer can approve and publish.
- Publication supersedes v1 records without deleting history.
- Mobile visibility changes only after publication.

## Mobile

- GPT-5.6 extracts the synthetic request.
- The app selects 200 py, 2 months rent-free, 2 parking spaces, and plan v2 after publication.
- Plan v1 is visibly blocked.
- External package includes sources and no unresolved facts.
- Sandbox send is impossible before human approval.
- Approved send creates an activity record.

## Weekly report

- LeaseFlow and mock Outlook activities are both used.
- Internal-only details are excluded.
- Five Korean commands produce source-backed findings.
- Natural-language changes are scoped patches with a before/after diff.
- To/Cc match the building recipient group.
- Final external report requires approval.

## Submission

- both surfaces are judge-accessible;
- demo data can be reset;
- README explains Codex/GPT-5.6;
- repository distinguishes prior planning from event-period implementation;
- narrated video is at most three minutes.
