# Security and Privacy

## Hackathon demo

- use synthetic data only;
- role switcher is clearly labeled as demo authentication;
- no real Outlook or company email;
- no raw private source files;
- no API key in client bundles;
- sandbox send only;
- source text minimized before AI calls;
- `store: false` for Responses API calls.

## Target team pilot

- invite-only users;
- MFA;
- role and portfolio/building access;
- RLS on every exposed table;
- private source and published-file buckets;
- short-lived signed URLs;
- device/session revocation;
- export and download audit;
- separated dev/test/prod;
- company-approved retention and Outlook permissions.

## Roles

- `data_steward`: upload and junior review;
- `senior_reviewer`: approve/reject and publish;
- `lm_manager`: prepare and approve external packages/reports;
- `lm_member`: prepare drafts and activities;
- `team_lead`: review team workload and reports;
- `admin`: user/role/configuration management.

## External output gate

Send is allowed only when:

- all required facts have current published versions;
- every file is current, published, and externally shareable;
- user has building access and output-approval permission;
- unresolved exceptions are cleared or explicitly excluded;
- recipients come from a configured group;
- approval event is recorded.
