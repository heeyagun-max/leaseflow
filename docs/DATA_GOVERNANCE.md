# Data Governance

## Stable identity versus versioned operations

Stable or slowly changing:

- building ID and aliases;
- address and market;
- organization and portfolio ownership;
- user/team assignments.

Versioned operational data:

- floor and marketed-space status;
- GLA/NLA and split/merge boundaries;
- availability and expected vacancy;
- rent, service charge, deposit, rent-free, TI/FO/support;
- free/paid/supported parking;
- move-in timing;
- approved floor plan and stacking plan;
- externally shareable marketing package.

## Fact lifecycle

```text
uploaded
→ extracted_candidate
→ junior_confirmed
→ senior_approved
→ published
→ superseded / rejected
```

## Communication lifecycle

Calls and email can create:

- activity facts;
- task candidates;
- under-discussion changes;
- report patches;
- next actions.

They cannot directly create or overwrite a published operational fact.

## Required metadata

- source document and page/section;
- uploader and upload time;
- extraction run and model;
- reviewer and decision;
- effective date;
- publication batch;
- superseded version;
- external-shareability flag;
- audit event.
