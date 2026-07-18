# Devpost Copy

Use the English section for the final form. The Korean section is a meaning check for the team. Replace only the bracketed URL fields after the destinations are publicly reachable or explicitly shared with judges.

## Submission fields

- Project name: `LeaseFlow Copilot`
- Track: `Work & Productivity`
- Admin URL: `[PENDING: public judge URL]`
- Mobile Web URL: `[PENDING: public judge URL]`
- Repository URL: `[PENDING: public or judge-accessible repository URL]`
- Video URL: `[PENDING: public narrated video URL, 3:00 maximum]`
- Primary Codex session ID: `019f7335-4b59-7e81-8131-b31800757887`

## English copy

### Tagline

Turn changing landlord source files into approved leasing data and current field packages.

### Elevator pitch

LeaseFlow Copilot is a governed leasing-operations demo. It registers incoming landlord materials as source assets, keeps AI and deterministic extraction results as proposals, requires Data Steward and Senior Reviewer decisions, and gives the field team only the current published version. The same approved activity becomes a building-specific weekly landlord report.

### Inspiration

Leasing information rarely arrives as one clean database update. Teams receive revised flyers, perspective images, floor plans, area workbooks, contracts, calls, and email requests. A superseded floor plan or outdated marketed area can still look plausible, which makes version mistakes operationally expensive.

We wanted to prove a safer role for AI in this workflow: AI proposes; code and accountable people decide.

### What it does

LeaseFlow has two connected experiences:

1. In the restricted Admin Web, incoming synthetic landlord sources are registered, classified, linked to provenance, reviewed by a Data Steward, and published by a Senior Reviewer.
2. Deterministic rules preserve duplicates and versions, keep confidential or unsupported files out of external output, and supersede an old floor plan when the approved replacement is published.
3. In the Mobile Operations App, an LM Manager confirms a synthetic broker request and prepares a package from current published facts and files only.
4. The user reviews configured recipients and attachments before recording a sandbox delivery. No real email is sent.
5. Approved operational activity is reused to prepare a building-specific weekly report, apply a scoped evidence-backed proposal, and record a second human-approved sandbox delivery.

The demo's key transition changes the current 5F marketed area from 300 py to 200 py and floor plan v1 to v2. Mobile excludes v1 after v2 is published.

### How we built it

We used an npm-workspace TypeScript monorepo with Next.js for the restricted Admin/API surface, Expo and React Native for the Mobile surface, Zod for runtime contracts, and deterministic domain functions for roles, publication state, authorization, current-version selection, recipients, and send gates. A resettable JSON adapter provides the local synthetic demo state. Supabase-compatible schema work represents a future persistence boundary; it is not the verified runtime datastore.

The credential-free judge path is the verified demo. It runs deterministic synthetic candidate generation under the same contracts used by the server adapter. `packages/ai` also includes a server-only OpenAI Responses API adapter with `store: false`, but we did not run a live external GPT call in the final environment because credentials were unavailable.

### How GPT-5.6 fits

The optional server adapter is designed to use the GPT-5.6 model identifier available to the project's OpenAI account for three bounded proposals: source-change extraction, request extraction, and a scoped weekly-report patch. Zod validates each response, and deterministic code still owns every operational decision. The final judge evidence covers the credential-free path, not a completed live GPT-5.6 call.

### How we used Codex

Codex helped implement and verify the shared domain rules, Admin and Mobile workflows, synthetic fixtures, API adapters, responsive UI, tests, launch scripts, and submission documentation. The event-period history runs from `62fdfea` through `b7f7e90`. The primary recorded Codex session ID is `019f7335-4b59-7e81-8131-b31800757887`.

Humans set the product boundary: communications cannot overwrite official property data, every external package and report needs approval, recipients come from configuration, and only current published authorized shareable records can leave the governed data layer.

### Challenges

- Treating a floor plan as versioned operational data instead of a static attachment.
- Keeping proposed classifications and extracted changes separate from official records.
- Sharing one audit trail across Admin and Mobile without giving Mobile publication authority.
- Making reset, stale-state handling, and sandbox delivery deterministic enough for repeatable judging.
- Communicating the demo boundary clearly without suggesting production integrations.

### Accomplishments

- One complete source-asset-to-field-package-to-weekly-report loop.
- Visible Data Steward and Senior Reviewer handoff.
- Current-version and provenance enforcement that blocks stale plan v1.
- Human approval and configured-recipient gates for every external-facing output.
- A credential-free, resettable synthetic judge path with 126 passing tests, five strict workspace typechecks, a passing Admin production build, Expo Web export, and responsive browser QA.

### What we learned

The highest-value AI behavior in a sensitive workflow is not autonomous action. It is a well-scoped proposal with visible evidence, followed by deterministic controls and a named human decision. Version and provenance rules are part of the user experience because they explain why a record is safe to use.

### What's next

After the hackathon, the next step is a limited pilot with an approved document repository, durable multi-user persistence, enterprise authentication, and controlled Microsoft 365 integration. Those integrations are not implemented or claimed in this submission.

### Built with

Codex, TypeScript, Next.js, Expo, React Native, Zod, Vitest, Playwright, and an optional server-side OpenAI Responses API adapter.

## Korean meaning check

### 한 줄 소개

임대인 측에서 들어오는 각종 자료를 승인 가능한 자산 정보로 바꾸고, 현장에는 현재 유효한 버전만 전달하는 임대 운영 서비스입니다.

### 해커톤에서 이 데모가 갖는 의미

LeaseFlow의 핵심은 AI가 업무를 대신 승인하는 것이 아닙니다. AI와 자동 분류는 후보를 제안하고, 코드는 권한·게시 상태·최신 버전·공유 가능 여부를 검사하며, 데이터 담당자와 선임 검토자가 책임 있는 결정을 내립니다.

이 구조는 임대 안내서, 조감도, 평면도, 면적 검토표, 계약 문서처럼 서로 다른 원자료가 계속 바뀌는 환경에서 특히 중요합니다. 출처와 버전 관계가 남아 있기 때문에 그럴듯하지만 오래된 평면도나 면적 정보가 현장 안내 자료에 다시 섞이는 오류를 막을 수 있습니다.

검증된 데모는 합성 데이터와 결정론적 후보 생성으로 실행됩니다. 서버용 OpenAI 어댑터와 `store: false` 설정은 구현되어 있지만, 자격증명이 없는 최종 환경에서 실제 외부 GPT 호출을 실행했다고 주장하지 않습니다. 실제 이메일·Outlook·SSO·전화·회사 시스템 연동도 포함하지 않으며, 모든 발송은 승인 후 기록만 남기는 샌드박스입니다.
