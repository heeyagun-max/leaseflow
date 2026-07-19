# G008 관리자 웹 수동·시각 QA

> **SUPERSEDED — 구현 전/초기 QA 기록.** 이 문서에서 보고한 overflow·focus·hydration 실패는 후속 구현에서 수정되었다. 현재 판정에는 이 문서를 사용하지 않으며, 권위 있는 최종 PASS와 검증 근거는 `G008_FINAL_QA.md`를 따른다.

- 실행일: 2026-07-19 (Asia/Seoul)
- 기준: `DESIGN.md`, `EXPERIENCE.md`, `docs/design/LEASEFLOW_ADMIN_G008_DESIGN_DECISION_MANIFEST_KO.md`
- 실행 표면: production `DEMO_MODE=true npm run start -w @leaseflow/admin-web -- --hostname 127.0.0.1 --port 3124` (Next 15.5.20), 실제 Chrome headless 및 Playwright/CDP 상호작용
- 참고: 기존 3000/3010은 `Cannot find module './901.js'`로 500이었다. 별도 3123 dev 검증 중 다중 headless 요청으로 `.next` ENOENT가 발생했으므로 최종 판정은 안정적인 3124 production에서 재검증했다.

## 판정 요약

주요 흐름과 전역/로컬 route는 production에서 렌더되고, h1/중복 ID/aria-current/desktop rail·mobile appbar 전환/드로어 포커스 복귀는 통과했다. 다만 320px `/sources`의 실제 가로 overflow와 200% 축소 CSS viewport에서의 최소 폭 강제가 G008 기준을 위반한다. Dev server에서 route-focus가 h1의 `tabindex`를 hydration 뒤 주입해 React hydration error가 발생하는 것도 수정이 필요하다(생산 번들 console은 깨끗함).

## `manualQa` matrix

### surfaceEvidence

| 시나리오 | 기준 | 표면·정확한 호출 | 판정 | artifactRefs |
|---|---|---|---|---|
| S01 | route | `curl -sS -o /tmp/x -w '%{http_code}' http://127.0.0.1:3124/{/,sources,changes,publishing,operations,reports,settings,sources/new,operations/versions,operations/files,settings/access,settings/audit}`; production Chrome direct navigation | PASS (전부 HTTP 200, 실제 h1 1개) | A01,A02,A03 |
| S02 | ≥1024 sidebar / current route | Chrome `--window-size=1440,1000` `/`; Playwright computed `display` and `[aria-current]` at 1440/1024 | PASS (1440/1024 rail flex, `aria-current="page"`, 2px rail focus) | A04,A05 |
| S03 | <1024 appbar+drawer | Playwright viewport 768/390; focus `메뉴 열기` → Enter → Escape | PASS (appbar flex, drawer open, close/Escape 뒤 trigger focus 복귀, dialog label 연결) | A06,A07 |
| S04 | visual representative | real Chrome screenshots at 1440/1280/1024/768/390/375/320 for `/`; 1440 global screenshots | PASS (clean production screenshots; warm canvas/nav hierarchy visible) | A02,A03,A08 |
| S05 | semantic/a11y | Playwright `document.querySelectorAll('h1')`, duplicate `[id]`, `[aria-current]`, dialog `aria-labelledby`; keyboard surface above | PASS (각 route h1=1, duplicate id=0, current labels localized, dialog heading wired) | A05,A06 |
| S06 | state loading/error/retry | Playwright route interception: `**/api/demo/workflow` → 500 JSON, navigate `/`, screenshot | PASS (안전한 한국어 오류, 영역 내 `다시 시도`, raw synthetic error 미노출) | A09 |
| S07 | state empty | production Chrome/Playwright `/sources?query=없는-파일` | PASS (empty copy + `필터 지우기`, raw query 미노출) | A10 |
| S08 | permission/read-only | production detail `/sources/Synthetic_Cobalt_perspective_render_20260701.svg`, role select → `James Kim · 임대 관리 책임자`; `/operations/files` | PASS (권한 안내, mutation button 없음; 이전 파일 읽기 전용 문구) | A11,A12 |
| S09 | console | `agbrowse navigate http://127.0.0.1:3124/` then `agbrowse console --clear --reload --duration 2000 --limit 100` | PASS (production console output 없음) | A13 |

### adversarialCases

| 시나리오 | 기준 | adversarial class | 기대 동작 | 판정 | artifactRefs |
|---|---|---|---|---|---|
| ADV01 | responsive 320 | horizontal overflow | `scrollWidth === clientWidth` on all representative routes | FAIL: `/sources` at 320 reports `scrollWidth=373`, `clientWidth=320`; source table/mobile layout leaks 53px | A03,A14 |
| ADV02 | 200% zoom | 2D scroll / min-width | 200% at effective CSS width 160 should remain one-directional | FAIL: `/`, `/sources`, `/changes`, `/settings` report root `scrollWidth=320` (or 373 for sources) vs `clientWidth=160`; `html { min-inline-size: 20rem; }` forces overflow | A15,A16 |
| ADV03 | keyboard skip/route focus | first focus / heading focus | skip link is first keyboard stop, route heading focus does not swallow it | FAIL (dev+production behavior): `RouteFocus` focuses h1 on load, first Tab lands queue link rather than `본문으로 바로가기`; implementation sets `heading.tabIndex=-1` in effect | A17 |
| ADV04 | console zero | hydration mismatch | no console error/warn on browser render | FAIL in dev surface: React reports hydration mismatch for h1 `tabindex` after `RouteFocus`; production is clean because error is dev hydration path | A18,A19 |
| ADV05 | route/selector | external/internal leak | no raw JSON, enum, API error, internal id, English fallback | PASS on production smoke/state scenarios; localized Korean labels and safe error copy observed | A09,A10,A11 |
| ADV06 | target size | 44px controls | visible primary controls >=44px | PASS for visible buttons/inputs/selects in screenshot and computed interaction paths; hidden desktop/mobile duplicate nav controls were excluded from visible target check | A04,A06 |
| ADV07 | fake plan | CSS fake floorplan | only actual file or explicit unsupported state | PASS: `/sources/...` reports explicit preview unsupported except published SVG; no CSS floorplan observed | A11 |

## Findings and smallest concrete fixes

1. **High — responsive horizontal overflow.** At 320px `/sources`, Playwright measured `document.documentElement.scrollWidth=373` vs `clientWidth=320`; clean screenshot shows filename/source columns clipped. Fix the mobile registry transformation/min-width constraints so the mobile `dl` is used and `min-inline-size:0; overflow-wrap:anywhere` propagates to row children; add a 320px E2E assertion.
2. **High — 200% reflow failure.** `html { min-inline-size: 20rem; }` at [apps/admin-web/app/globals.css:90-93] guarantees a 320px minimum layout when effective viewport is 160px. Remove the hard minimum (use `min-inline-size:0`) and verify 200% with a CSS viewport equivalent; no 2D scroll.
3. **Medium — keyboard skip order/hydration.** [apps/admin-web/components/governance/admin-shell.tsx:12-19] focuses h1 and adds `tabIndex` in `useEffect`, causing the first Tab to skip `본문으로 바로가기` and causing the dev hydration mismatch. Render a stable focusable h1 attribute server-side (or focus `main` after navigation while preserving skip-link entry) and add a route-focus keyboard test.
4. **Low/infra — existing 3000/3010 server processes were unusable** (`Cannot find module './901.js'`); 3124 production is healthy and is the evidence surface used above.

## Artifact refs

| id | kind | description | path |
|---|---|---|---|
| A01 | http | production route smoke status output | `artifacts/visual-qa/g008/route-status-3124.txt` |
| A02 | screenshot | clean production `/` at 1440/1280/1024/768 | `artifacts/visual-qa/g008/clean-1440-home.png`, `clean-1280-home.png`, `clean-1024-home.png`, `clean-768-home.png` |
| A03 | screenshot | clean production `/` at 375/320 | `artifacts/visual-qa/g008/clean-375-home.png`, `clean-320-home.png` |
| A04 | screenshot | clean desktop home/sidebar | `artifacts/visual-qa/g008/clean-1440-home.png` |
| A05 | computed | Playwright production h1/duplicate-id/aria-current/nav matrix | `artifacts/visual-qa/g008/computed-metrics.md` |
| A06 | interaction | drawer open/close/Escape focus-return | `artifacts/visual-qa/g008/keyboard-evidence.md` |
| A07 | screenshot | mobile appbar surface | `artifacts/visual-qa/g008/clean-375-home.png` |
| A08 | screenshot | clean 1440 global route captures | `artifacts/visual-qa/g008/clean-1440-sources.png`, `clean-1440-changes.png`, `clean-1440-publishing.png`, `clean-1440-operations.png`, `clean-1440-reports.png`, `clean-1440-settings.png` |
| A09 | screenshot | intercepted error/retry state | `artifacts/visual-qa/g008/state-error-390.png` |
| A10 | screenshot | empty source filter state | `artifacts/visual-qa/g008/state-empty-sources-390.png` |
| A11 | computed | permission/detail state evidence | `artifacts/visual-qa/g008/permission-evidence.md` |
| A12 | screenshot | read-only file history | `artifacts/visual-qa/g008/state-readonly-files-390.png` |
| A13 | console | production console cleared/reloaded with no output | `artifacts/visual-qa/g008/console-production.txt` |
| A14 | computed | 320px `/sources` scroll metrics | `artifacts/visual-qa/g008/computed-metrics.md` |
| A15 | screenshot | effective 200% root viewport (160 CSS px) | `artifacts/visual-qa/g008/prod-200pct-home.png` |
| A16 | screenshot | effective 200% sources viewport (160 CSS px) | `artifacts/visual-qa/g008/prod-200pct-sources.png` |
| A17 | source | route focus implementation | `apps/admin-web/components/governance/admin-shell.tsx:12-19` |
| A18 | console | dev hydration mismatch output | `artifacts/visual-qa/g008/console-dev-hydration.txt` |
| A19 | source | h1 server markup lacks stable tabindex while effect adds it | `apps/admin-web/components/governance/admin-pages.tsx:56-58`, `apps/admin-web/components/governance/admin-shell.tsx:14-18` |
