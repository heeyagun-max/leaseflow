# System Architecture

```text
┌─────────────────────────────┐       ┌──────────────────────────────┐
│ Restricted Data Admin Web   │       │ Mobile Operations App        │
│ Next.js                     │       │ Expo / React Native + Web    │
│                             │       │                              │
│ source upload               │       │ activity inbox               │
│ extraction candidates       │       │ request review               │
│ junior confirmation         │       │ data / file retrieval        │
│ senior approval             │       │ package + report approval    │
└──────────────┬──────────────┘       └──────────────┬───────────────┘
               │                                      │
               └───────────────┬──────────────────────┘
                               ▼
                 ┌───────────────────────────────┐
                 │ Shared server/API             │
                 │ auth and policy checks        │
                 │ GPT-5.6 adapter               │
                 │ publication and audit logic   │
                 └──────────────┬────────────────┘
                                ▼
                 ┌───────────────────────────────┐
                 │ Postgres + private storage    │
                 │ versioned facts and files     │
                 │ activities, packages, reports│
                 └───────────────────────────────┘
```

## Hackathon deployment

- Admin web: Vercel or equivalent.
- Mobile: Expo web build for judges; Expo Go/internal build is optional.
- Data: local demo adapter first; optional Supabase deployment.
- Email: sandbox event, not a real company send.
- Outlook: mock connector only.

## Production evolution

- enterprise identity/SSO;
- MFA and device/session controls;
- private storage and signed URLs;
- Microsoft Graph delegated permissions after company approval;
- native internal distribution;
- environment separation and retention policy.
