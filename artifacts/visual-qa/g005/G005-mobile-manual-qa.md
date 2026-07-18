# G005 Mobile manual QA

Surface under test: Expo Web Mobile launched with the documented local command
`EXPO_PUBLIC_LEASEFLOW_API_URL=http://localhost:3000 npm run web -w @leaseflow/mobile -- --port 8081`.
Browser invocation: headless Chromium via Playwright at `http://localhost:8081`.

## Surface evidence

| Scenario | Criterion | Surface / exact invocation | Verdict | Artifact refs |
| --- | --- | --- | --- | --- |
| M-375 | Responsive mobile surface at 375px; labels, example, reset, nav | `page.setViewportSize({width:375,height:812}); page.goto('http://localhost:8081'); body.scrollWidth/document.documentElement.scrollWidth` | PASS | `mobile-375.png`; DOM evidence: 375/375/375, root width 375, labels found, no console errors |
| M-768 | Tablet-width surface at 768px; no horizontal overflow | `page.setViewportSize({width:768,height:1024}); page.goto('http://localhost:8081')` | PASS | `mobile-768.png`; DOM evidence: 768/768, root width 768, labels found, no console errors |
| M-1280 | Wide surface at 1280px; layout fills viewport and bottom nav remains visible | `page.setViewportSize({width:1280,height:900}); page.goto('http://localhost:8081')` | PASS | `mobile-1280.png`; DOM evidence: 1280/1280, root width 1280, labels found, no console errors |
| M-content | Example request is readable and current information remains visible | `document.querySelector('textarea').value` and body text inspection at 375px | PASS | `mobile-375.png`; textarea value contained the full Korean synthetic request; current-info card contained Cobalt Finance Center · 5층 and area/terms |
| M-reset | Reset action has destructive confirmation and returns to seed state | Click `button[name="처음 상태로 되돌리기"]`, accept dialog, wait for UI feedback | PASS | `mobile-375.png`, `qa-report`; browser dialog text captured; UI displayed `최신 상태로 동기화했습니다` and `데모를 처음 상태로 되돌렸습니다...`; no console errors |

## Adversarial cases

| Scenario | Criterion | Class | Expected | Verdict | Artifact refs |
| --- | --- | --- | --- | --- | --- |
| A-narrow | Responsive overflow resistance | 320px narrow viewport | `body.scrollWidth <= innerWidth`, root width equals viewport | PASS | `qa-report`; DOM evidence: 320/320, root width 320, overflow false |
| A-origin | Local two-terminal integration | Browser origin `http://localhost:8081` calling API `http://localhost:3000` | Reset preflight and POST expose CORS allow-origin and success notice | PASS | `qa-report`; `OPTIONS` returned 204 with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: POST,OPTIONS`; revision-matched POST returned 200 with the same CORS headers and UI success notice |
| A-console | Browser runtime errors | Load each target viewport; collect `console` error and `pageerror` events | No console/page errors | PASS for page loads | `mobile-375.png`, `mobile-768.png`, `mobile-1280.png`; consoleErrors=[] on each load |

## Artifact refs

| ID | Kind | Description | Path |
| --- | --- | --- | --- |
| mobile-375 | png | Verified normal 375px Mobile screenshot | `/Users/heeya/Downloads/LeaseFlow_Team_Pilot_Hackathon_MVP/artifacts/visual-qa/g005/mobile-375.png` |
| mobile-768 | png | Verified normal 768px Mobile screenshot | `/Users/heeya/Downloads/LeaseFlow_Team_Pilot_Hackathon_MVP/artifacts/visual-qa/g005/mobile-768.png` |
| mobile-1280 | png | Verified normal 1280px Mobile screenshot | `/Users/heeya/Downloads/LeaseFlow_Team_Pilot_Hackathon_MVP/artifacts/visual-qa/g005/mobile-1280.png` |
| qa-report | markdown | This manual QA matrix and invocation evidence | `/Users/heeya/Downloads/LeaseFlow_Team_Pilot_Hackathon_MVP/artifacts/visual-qa/g005/G005-mobile-manual-qa.md` |
