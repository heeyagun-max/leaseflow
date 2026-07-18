# Start Here — LeaseFlow Team Pilot / OpenAI Build Week MVP

This repository reflects the **revised product direction**:

- a restricted **Data Admin Web** for designated users who ingest, review, approve, and publish leasing source data;
- a **Mobile Operations App** for LM managers and team members who handle requests, prepare packages, approve external email, and generate weekly landlord reports;
- one shared secure backend, domain model, AI layer, and audit trail.

The hackathon build is an **architecture-complete but functionally narrow vertical slice**. It does not claim production SSO, production Outlook access, carrier-call APIs, or company approval.

## Use with Codex

1. Unzip this folder once.
2. Create a new private Git repository from the folder.
3. Open the entire repository in Codex.
4. Keep one primary Codex thread for most core development.
5. Ask Codex to read, in order:
   - `AGENTS.md`
   - `CURRENT_VERSION_AND_MANIFEST.md`
   - `README.md`
   - `docs/PRODUCT_DIRECTION.md`
   - `docs/HACKATHON_MVP_SCOPE.md`
   - `docs/SYSTEM_ARCHITECTURE.md`
   - `docs/WORKFLOWS.md`
   - `docs/DATA_GOVERNANCE.md`
   - `docs/SECURITY_AND_PRIVACY.md`
   - `prompts/MODEL_CONTRACTS.md`
   - `tests/golden_cases.yaml`
   - `prompts/codex_master_prompt.md`
6. Paste `prompts/codex_master_prompt.md` into the primary build thread.
7. Run `/feedback` in the primary thread before submission and save the Session ID.

## Canonical version rule

`CURRENT_VERSION_AND_MANIFEST.md` is the naming and packaging authority. The only approved final-package baseline is `LeaseFlow_Final_Master_Package_v3.0.0.zip`, whose extracted top-level folder must be `LeaseFlow_Final_Master_Package_v3.0.0`. Do not describe older ZIPs or planning documents as the current master.

## First milestone

Build and verify the **Source-to-Publish** path before polishing the UI:

1. Admin user selects the synthetic July source update.
2. GPT-5.6 produces structured change candidates.
3. Junior confirms the candidates.
4. Senior approves and publishes them.
5. Published version becomes visible to the mobile app.
6. Superseded terms and floor plans are blocked from external output.

## Data safety

Use only the synthetic data in `data/demo/`. Never commit real company email, Outlook exports, phone recordings, contact details, confidential leasing terms, weekly reports, or proprietary PDFs.
