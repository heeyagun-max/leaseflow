# LeaseFlow: Codex for Everyone

OpenAI Build Week 2026 submission master  
Track: Work & Productivity  
Devpost project: `leaseflow-copilot`  
Prepared from the live Devpost form on July 20, 2026

## 1. Submission source of truth

- Submission deadline: Tuesday, July 21, 2026 at 5:00 PM Pacific Time; Wednesday, July 22 at 9:00 AM Korea Standard Time.
- Required deliverables: a working project, one category, a project description, a public YouTube demo under three minutes, a judge-accessible code repository, and the primary Codex `/feedback` Session ID.
- The video needs spoken narration covering what was built, how Codex was used, and how GPT-5.6 was used.
- If the repository remains private, share it with `testing@devpost.com` and `build-week-event@openai.com` before the deadline.
- Recommended category: `Work & Productivity`.

The judging criteria are Technological Implementation, Design, Potential Impact, and Quality of the Idea. The submission below answers those criteria directly while keeping the verified demo boundary explicit.

## 2. Exact Devpost form answers

### Project identity

**Project name**  
LeaseFlow: Codex for Everyone

**Tagline**  
Turn messy landlord documents and real user feedback into governed leasing workflows that always use the latest approved information.

**Built with**  
Codex, GPT-5.6, TypeScript, Next.js, React, React Native, Expo, Zod, Vitest, Playwright

**Project URL**  
No durable hosted Admin URL is claimed for the single-process JSON demo. Judges can run the complete credential-free path from the public repository.

**Mobile Web URL**  
No durable hosted Mobile Web URL is claimed. The repository includes the Expo Web test surface and local judge instructions.

**Demo video URL**  
`https://youtu.be/e9lG8biI8GY` — public, signed-out playback verified, 2:55.

**Final local video artifact**  
`artifacts/submission/LeaseFlow_OpenAI_Build_Week_Demo_EN.mp4` — 2:55, English narration, 1920×1080 H.264/AAC. Upload this exact file to YouTube and then replace the URL placeholder above.

### Custom submission questions

**Submitter Type — field 27945**  
`Individual` — confirm before final submission.

**Country of Residence — field 27946**  
`Korea Republic of` — confirm before final submission.

**Category — field 27947**  
`Work & Productivity`

**Code repository — field 27948**  
`https://github.com/heeyagun-max/leaseflow`

Public access was verified without authentication on July 21, 2026. The final submission commit is `6b1e7554be92c304710c6e0de9bf78007a6a78a8` on `main`.

**Project test link and instructions — field 27949**  

> Open the Admin URL first, then open the Mobile Web URL. Use synthetic data only. In Admin, open **Building Data Intake → Upload Source**, download the synthetic sample source, upload it, review the proposed changes, confirm them as the Data Steward, switch to the Senior Reviewer, and publish. In both Admin and Mobile, confirm that the current 5F values change from 300 py / 3 months / 3 spaces / plan v1 to 200 py / 2 months / 2 spaces / plan v2. Then open **Requests** to prepare a customer package and **Weekly Reports** to prepare a building-specific report. Every delivery is a sandbox record; no real email is sent. No credentials are required for the demo.

**Primary `/feedback` Session ID — field 27950**  
`019f7335-4b59-7e81-8131-b31800757887`

This ID is recorded in the repository. Capture and verify the real `/feedback` UI before final submission; do not substitute the ID alone if the form requires a completed feedback action.

**Plugin or developer-tool instructions — field 27951, optional**  

> LeaseFlow is submitted to Work & Productivity, not Developer Tools. The repository includes an optional thin skill at `skills/codex-for-everyone`. It can be invoked from the repository or copied into the user's Codex skills directory. The skill helps a domain expert turn real artifacts, bottlenecks, and corrections into a governed workflow, an end-to-end product slice, and an evidence-backed user test. It is not required to run the LeaseFlow demo.

## 3. Full project description

### Inspiration

This project began as a conversation, not a codebase.

Commercial leasing teams receive updated flyers, floor plans, area workbooks, contracts, calls, and email requests from many owners and buildings. The documents look familiar even when a number, available floor, incentive, or plan has changed. A team member can spend more time reconstructing what is current than responding to the broker or preparing the weekly owner meeting.

I started with the work itself: the documents, the handoffs, and the corrections from the person who actually does the job. I used Codex to turn that lived workflow into an information architecture, a data authority model, a working Admin Web and Mobile experience, and a repeatable test path.

The result is LeaseFlow. The broader idea is Codex for Everyone: a domain expert should be able to describe real work in ordinary language, show the artifacts, challenge the design, and collaborate with Codex until the bottleneck becomes a usable, verifiable workflow.

### What it does

LeaseFlow connects five parts of leasing operations.

1. **Register and understand landlord source material.** A designated user chooses the building and source type, uploads a document, and reviews the extracted content. Text-based PDF, DOCX, and XLSX files can become structured review material. Image-only or unsupported drawings stop for manual review instead of silently becoming official data. Large landlord documents are analyzed rather than rejected only because of file size.
2. **Confirm and publish current building information.** Extracted changes remain proposals. A Data Steward confirms them and a Senior Reviewer publishes them. Versioned fields such as available area, floors, incentives, parking, availability dates, and floor plans retain their source and history. A superseded floor plan cannot re-enter a current external package.
3. **Use the same current information across Web and Mobile.** Team members can find a building, inspect its latest operational facts, prepare a customer package, and see the original source link without learning internal state names or program concepts.
4. **Automate weekly work by landlord.** A manager groups assigned buildings under the correct landlord, configures the weekly meeting schedule, required sections, recipients, and approver, then prepares separate building-specific reports from the week's approved information and activity.
5. **Keep consequential actions human-owned.** AI output is a candidate, draft, or patch. Deterministic code controls publication, authorization, current-version selection, recipient groups, and delivery gates. External packages and reports require a named human approval. The demo records sandbox deliveries only.

The verified path shows a 5F record changing from 300 py to 200 py, rent-free from three months to two, supported parking from three spaces to two, and floor plan v1 to v2. After publication, both Web and Mobile use v2 and exclude v1.

### How we built it

LeaseFlow is an npm-workspace TypeScript monorepo.

- Next.js provides the Admin Web, shared Web workflows, and demo API.
- Expo and React Native provide the mobile operations experience and Mobile Web test surface.
- A shared domain package owns roles, publication rules, authorization, current-version selection, recipient calculation, and send gates.
- Zod validates source-extraction, request-extraction, and weekly-report patch candidates.
- A resettable single-process JSON store makes the synthetic judge path reproducible.
- Vitest, Node tests, TypeScript strict checks, build checks, and browser QA protect the end-to-end workflow.

The credential-free demo uses deterministic synthetic candidates under the same validation contracts as the optional server-side OpenAI adapter. The adapter is designed for bounded GPT-5.6 proposals and sends `store: false`, but the final verified product path does not claim a live external model call, Outlook delivery, SSO, carrier integration, or production datastore.

### How we used Codex and GPT-5.6

GPT-5.6 powered the Codex collaboration used to build and refine the project. Codex did more than generate a first implementation.

- It read the product specification, workflow notes, and source-document patterns.
- It translated natural-language corrections into a shared data model, state transitions, navigation, labels, and acceptance tests.
- It responded to annotated browser feedback such as removing redundant explanations, showing current work instead of feature tiles, listing all assigned buildings, adding return navigation, and aligning status indicators consistently.
- It helped test actual document categories and convert failures into product rules. For example, a 20MB upload cap was removed after the user explained that landlord source material must be analyzed regardless of size; the revised path successfully processed a 62MB, 358-page test document into human review.
- It created evidence for the complete upload → review → publish → Web/Mobile synchronization path and prepared a remote evaluation route for the real user.

The human remained the source of domain truth. Codex converted that knowledge into inspectable product behavior and tests. The repository includes a thin `codex-for-everyone` skill that distills this collaboration loop so another person can begin from their own work instead of from software vocabulary.

### Challenges we ran into

- The first designs looked like feature dashboards rather than the user's actual day. Repeated browser feedback forced the Home experience to center current work, latest building changes, and weekly-report progress.
- A fluent extraction is not the same as an official fact. We had to separate source registration, AI proposals, Data Steward confirmation, Senior publication, and external use.
- Commercial documents vary widely. A text-heavy flyer, area workbook, legal document, image-based perspective, drawing file, and very large portfolio PDF need different review boundaries.
- A weekly owner meeting may cover several buildings, but each external report must remain building-specific and use the configured recipient and approval authority.
- A remote real-user test exposed deployment truth: a single-process JSON demo can be shared through a temporary tunnel, but it should not be presented as a durable multi-instance deployment.

### Accomplishments that we are proud of

- One working path from landlord source upload to confirmed publication, current Web and Mobile use, customer-package preparation, and landlord weekly reporting.
- Real source-category handling that preserves official building facts when a document is only suitable as reference or manual review material.
- A shared current-information contract across Admin, common Web workflows, and Mobile.
- Explicit version and provenance controls that prevent stale plan reuse.
- Human approval and configured-recipient gates for every external-facing output.
- A synthetic sample that a judge can download and run without credentials.
- 289 passing automated tests, five strict workspace typechecks, and a passing repository package validation in the final documentation pass.
- A reusable thin skill that captures how a domain expert and Codex moved from conversation to tested workflow.

### What we learned

The most useful role for AI in a sensitive workflow is not autonomous authority. It is the reduction of reconstruction work.

Codex can help a person surface hidden rules that are obvious inside the job but absent from a software brief: which document is current, who can make it official, which information may leave the company, what belongs in a landlord meeting, and what a mobile user must see without scrolling or decoding system language.

We also learned that conversation becomes valuable only when it is closed by evidence. A correction should become a product rule, a working path, and a test that the real user can challenge again.

### What's next

The immediate next step is a limited pilot with the real leasing user using safe test data. His feedback will determine which steps still feel artificial, which building fields are missing, and whether the weekly landlord report matches the meeting itself.

After that, LeaseFlow needs durable multi-user persistence, enterprise identity and role provisioning, an approved document repository, and controlled Microsoft 365 integration. Those production integrations are not implemented or claimed here.

Codex for Everyone can then be applied to a second domain. The goal is to test whether the same thin loop — evidence, workflow reconstruction, authority mapping, one vertical slice, real-user correction, and verification — can remove a different person's recurring bottleneck without requiring that person to become a software product manager first.

## 4. Two-minute-fifty-five-second English demo narration

The final English script and captions are in `docs/submission/DEMO_VIDEO_EN.md` and `docs/submission/LeaseFlow_OpenAI_Build_Week_Demo_EN.srt`. Seven equal 25-second chapters leave a five-second safety margin below the hard three-minute limit.

### 0:00–0:25 — A real bottleneck becomes a product

**Show:** Title card, synthetic landlord documents, then Admin Home.

> I built LeaseFlow to help my husband break through a serious bottleneck in his leasing work. I use AI every day, but he doesn't. Instead of asking him to become an AI power user, I used Codex to turn his real workflow, documents, and corrections into a tool that works the way he already works.

### 0:25–0:50 — Register and analyze a source

**Show:** Building Data Intake, select the building and source type, attach the synthetic sample, upload, then reveal the extracted candidate changes.

> A designated user registers a landlord source by building and document type, then uploads the file. The server-side GPT-5.6 adapter is designed to propose structured changes. For this credential-free judge path, the same validated contract runs deterministically against the synthetic sample. The source is preserved, but the candidate is not yet official information.

### 0:50–1:15 — Human confirmation and publication

**Show:** Data Steward confirmation, switch to Senior Reviewer, then publish.

> The Data Steward confirms source-backed changes. The Senior Reviewer decides what becomes current. Here, 5F changes from three hundred to two hundred py, rent-free from three to two months, parking from three to two spaces, and plan v2 replaces v1. The old plan remains in history but cannot enter a current package.

### 1:15–1:40 — One current record across Web and Mobile

**Show:** Admin building detail, original-source link, then Mobile Current Leasing Information.

> Publication updates one shared record. The Admin Web and Mobile app now show the same latest information, including the original source link. Users do not need lifecycle codes or data-pipeline explanations. They need the correct building facts and the current file, wherever they are working.

### 1:40–2:05 — Prepare a customer package safely

**Show:** Enter a natural-language request, prepare the package, inspect included facts and plan, then show the approval gate and sandbox delivery record.

> From the same current record, a team member can use natural language to prepare a customer package. Only active, authorized, externally shareable facts and files are selected. The package still requires a named human approval, and this demo records only a sandbox delivery. No real email is sent.

### 2:05–2:30 — Automate weekly work by landlord

**Show:** Weekly Reports list, landlord configuration, assigned buildings, required sections, recipients and approver, then one building-specific report.

> Weekly reporting is organized by landlord meeting, because one owner may have several buildings. The user configures the buildings, schedule, required sections, recipients, and approver. LeaseFlow prepares a separate report for each building from that week's approved information and activity, ready for human review.

### 2:30–2:55 — Codex collaboration, evidence, and close

**Show:** Annotated browser feedback, the primary Codex task, passing verification, the thin skill, then the final LeaseFlow title card.

> Codex did more than scaffold code. I used GPT-5.6 in Codex to reconstruct the workflow, translate annotated browser feedback into product rules, test document categories, and verify the full path. LeaseFlow is the first example of Codex for Everyone: AI adapts to the worker, instead of asking every worker to become an AI expert.

## 5. Codex for Everyone: thin skill summary

The skill is intentionally small. It does not try to encode every product method. It gives Codex seven reusable moves:

- collect real artifacts and identify the actual user;
- reconstruct trigger, input, decisions, handoffs, output, and exceptions;
- separate source authority, AI proposal, code enforcement, and human approval;
- define one end-to-end slice in the user's vocabulary;
- implement visible states and next actions;
- test with the real user and classify every complaint;
- package the verified result and state what is still only planned.

Skill location: `skills/codex-for-everyone/SKILL.md`

## 6. Final owner checklist

- [x] Confirm `Individual` and `Korea Republic of` in the Devpost custom fields.
- [x] Use `LeaseFlow: Codex for Everyone` consistently as the final project title.
- [x] Publish the repository and verify unauthenticated access to `https://github.com/heeyagun-max/leaseflow`.
- [x] Complete a public-release audit; private reference inputs and generated local artifacts remain ignored.
- [x] State the deployment boundary instead of inventing stable Admin or Mobile URLs for the single-process demo.
- [x] Render the English voiceover video under three minutes and verify the local MP4.
- [x] Upload `LeaseFlow_OpenAI_Build_Week_Demo_EN.mp4` to YouTube as Public and verify signed-out playback.
- [x] Submit the required primary Codex `/feedback` Session ID `019f7335-4b59-7e81-8131-b31800757887`.
- [x] Save the exact form answers, repository URL, and video URL in Devpost.
- [x] Submit successfully at 2026-07-21 08:47:44 KST. Submission ID: `1083222`.
