# Three-Minute Demo Script

## 0:00–0:18 — problem and architecture

Show the two user surfaces. Explain that leasing data changes frequently, including available area, terms, parking, and floor plans.

## 0:18–0:52 — Admin Web

- open synthetic July source update;
- GPT-5.6 extracts 300 py → 200 py, plan v1 → v2, rent-free 3 → 2 months, supported parking 3 → 2;
- junior confirms;
- switch to senior and publish;
- show prior versions retained.

## 0:52–1:38 — Mobile request

- import a synthetic call or email requesting current 5F materials;
- GPT-5.6 extracts building, floor, requested terms/files, recipient, and deadline;
- mobile app retrieves the new published 200 py record and plan v2;
- old 300 py plan v1 is blocked;
- email and attachment package are prepared.

## 1:38–1:58 — approval and memory

- review source coverage and recipients;
- approve sandbox send;
- show activity recorded against the building.

## 1:58–2:36 — weekly report

- run report from LeaseFlow activity + mock Outlook;
- use `협의 중인 면적 변동 있는지 확인해`;
- show source-backed findings and a scoped patch;
- accept diff.

## 2:36–2:52 — external report

- show building-specific To/Cc group;
- approve the external cover email/report.

## 2:52–3:00 — build evidence

Explain that Codex implemented the monorepo, schema, tests, UI, and deployment; GPT-5.6 performs source extraction, request understanding, and report patches. Show `/feedback` Session ID placeholder and repository.
