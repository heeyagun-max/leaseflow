# Demo video build and verification

The checked-in MP4 is generated only from LeaseFlow synthetic runtime/UI. No user-supplied landlord PDF, DWG, XLSX, or DOCX file is opened or shown.

## Final local artifact

- Path: `artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4`
- Duration: 109.145 seconds
- Dimensions/codecs: 1920×1080, H.264 + MPEG-4 AAC
- Size: 51,723,559 bytes
- SHA-256: `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`
- Automated content checks: final seven-frame OCR found synthetic markers and zero generic secret-pattern matches
- Local sensitive-identifier coverage: optional blocked terms can be supplied out of repo; no such list is committed or claimed by the reproducible check
- Manual visual checks: samples at 5, 30, 60, and 90 seconds passed

These checks prove the intentionally checked-in local submission artifact. It has not been pushed to a public host or uploaded, so a public URL and signed-out playback remain external submission actions and are not claimed.

## Rebuild

1. Build and run Admin in production mode so Next development overlays cannot enter the capture:

```bash
npm run build -w @leaseflow/admin-web
DEMO_MODE=true SANDBOX_EMAIL_MODE=true \
  LEASEFLOW_DEMO_STATE_PATH=../../data/demo/.runtime/video-state.v1.json \
  npm run start -w @leaseflow/admin-web -- --hostname 127.0.0.1 --port 3000
```

2. In another terminal, start the Mobile web runtime used as the health check:

```bash
npm run demo:mobile
```

3. Capture the current synthetic UI and render the Korean narration:

```bash
zsh scripts/demo-video/capture.sh
zsh scripts/demo-video/render.sh
```

4. Verify the playable tracks, duration, dimensions, and size:

```bash
swift scripts/demo-video/probe.swift artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4
swift scripts/demo-video/verify-content.swift artifacts/submission/video-frames
swift scripts/demo-video/sample.swift artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4 artifacts/submission/video-samples
```

For a local sensitive-identifier check without committing identifiers or derived values, put one blocked term per line in a file outside the repository and run:

```bash
LEASEFLOW_VIDEO_BLOCKED_TERMS_FILE=/absolute/path/outside/repo/blocked-terms.txt \
  swift scripts/demo-video/verify-content.swift artifacts/submission/video-frames
```

The verifier reports whether the uncommitted local term file was configured; its built-in automated coverage is limited to generic API-key, Bearer-token, credential-assignment, and private-key-marker patterns.

## Boundaries stated in the video

- All runtime and UI data is synthetic.
- AI output remains a candidate, draft, or patch until the correct human role accepts it.
- External package and weekly report workflows require human approval.
- “Send” records a sandbox event only.
- There is no production Outlook, SSO, carrier-call, company-system, or external delivery integration.
- No public upload or public URL is claimed.
