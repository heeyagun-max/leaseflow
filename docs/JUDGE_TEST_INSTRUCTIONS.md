# Judge Test Instructions

## Start the credential-free demo

Prerequisites: Node.js 20+ and npm. From the repository root, install and verify once:

```bash
npm ci
npm run validate
npm run test
```

Do not create a root `.env.local` for this path. The launch scripts explicitly select synthetic `DEMO_MODE`, sandbox communication behavior, the writable demo-state file, and the browser-visible API URL.

Terminal 1:

```bash
npm run demo:admin
```

Open Admin Web at <http://localhost:3000>. Wait for it to load before starting Terminal 2.

Terminal 2:

```bash
npm run demo:mobile
```

Open Expo Web at <http://localhost:8081>. It is launched with `EXPO_PUBLIC_LEASEFLOW_API_URL=http://localhost:3000`.

No OpenAI, Outlook, SSO, email, carrier, Supabase, or company-system credentials are required. All repository and demo content is synthetic.

## Recommended test path

1. In Admin Web, set `검토 담당자` to `Mina Lee · 데이터 담당자`.
2. Click `변경안 4건 찾기`, review the four source-backed changes, then click `변경안 확인 완료`.
3. Change `검토 담당자` to `Daniel Park · 선임 검토자`, then click `승인하고 게시하기`.
4. Open Mobile Web and confirm the role badge says `임대 관리 책임자`.
5. Under `고객 요청`, click `예시 요청 불러오기`, review the extracted request, then click `요청 확인`.
6. Click `안내 자료 만들기`. Verify the superseded plan v1 is excluded and the current plan v2 is selected.
7. Click `안내 자료 승인`, review the configured recipients and attachment, then click `확인하고 발송하기`. This records a sandbox delivery only.
8. Open `주간 보고서` and click `건물별 보고서 초안 만들기`.
9. Choose `협의 면적 변동 확인` (the UI label for `협의 중인 면적 변동 있는지 확인해`). Review the evidence-backed proposal and click `제안 반영`.
10. Click `보고서 승인`, review the configured recipients, then click `확인하고 발송하기`. This also records a sandbox delivery only.

## Reset

Keep Admin Web running, then execute from another terminal:

```bash
npm run demo:reset
```

The command calls `GET /api/demo/workflow`, reads `state.revision`, and sends it as `expected_revision` to `POST /api/demo/reset`. This preserves the same optimistic concurrency rule as the UI. Reload both browser tabs after the command reports the old and new revision.

If Admin Web is hosted elsewhere, override only the reset target:

```bash
LEASEFLOW_API_URL=https://admin.example.invalid npm run demo:reset
```

The `.invalid` address is illustrative, not a deployed URL. Public test URLs are pending deployment.

## Demo boundaries

- Every external package and weekly report still requires human approval.
- “Send” behavior is sandbox simulation; there is no production email, Microsoft Graph, SSO, or carrier-call integration.
- Admin uses a single-process writable JSON demo adapter. It is not a multi-instance or durable production datastore.
- Mobile consumes published, active, authorized, externally shareable records from the Admin API; it does not publish official property data.
