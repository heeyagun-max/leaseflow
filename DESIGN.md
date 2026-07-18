# LeaseFlow Design System

## 0. Research Log

- Embedded references: shortlisted Supabase, Linear, and Sentry; selected Layer A `soft-skill` + Layer B `supabase` because LeaseFlow needs premium material craft without losing an operations console's density, auditability, or restrained status color.
- Lazyweb: three queries (`commercial real estate operations dashboard approval workflow`, `document review approval admin dashboard`, `field operations property mobile app workflow`), four screens viewed. Dealpath supplied approval-preview hierarchy and one clear CTA; Jobber supplied fixed navigation, a workflow strip, and a focused support rail; PandaDoc supplied compact state tabs, list-detail density, and an explicit timeline. The AppFolio mobile result was rejected because it is a property contact landing page, not an operations or approval workflow, and therefore offers no useful state, provenance, or task-density grammar.
- UI/UX database: the operations query recommended a dark, status-led, data-dense system; the color lookup reinforced near-black/slate surfaces with accessible green state signals; the typography lookup reinforced a Korean-readable sans with a restrained mono companion. The generic Cinzel/Josefin real-estate pairing was rejected because it reduces scan speed in operational tables.
- Imagen drafts: skipped for this primitive-only extraction milestone. The owner supplied a locked direction and a set of actual shipped-product references; no product screen may be composed until the primitive showcase passes.
- Reference-use boundary: references inform layout grammar and component anatomy only. No logo, screenshot, copy, or brand-specific composition is copied or shipped.

## 1. Atmosphere & Identity

LeaseFlow is a quiet, high-trust operations command center: near-black, precise, and calm enough for long review sessions, but rich enough to make governed state feel tangible. Its signature is the **governance bezel**—a thin emerald-tinted outer tray around a dark inner work surface, with a top rim light and a restrained radial “verification field.” The memorable moment is a workflow state moving from neutral graphite to verified emerald only after a human-controlled transition; green never decorates unverified content.

The system combines Supabase's dark emerald identity, alpha-layered borders, regular-weight typography, and border-defined depth with the double-bezel material discipline from `soft-skill`. It intentionally avoids generic purple SaaS gradients, over-rounded card grids, heavy shadows, glass blur on scrolling content, and ornamental motion.

### Design principles

1. **State before spectacle.** Every surface answers “what state is this in, who owns the next action, and what evidence supports it?”
2. **Green means governed.** Emerald signals a verified or primary interactive state, never unreviewed AI output.
3. **Density with wayfinding.** Compact data is grouped by stage, provenance, and action so users do not need to remember hidden context.
4. **One consequential action.** Each task region presents one visually dominant next action; destructive or irreversible actions are spatially separated.
5. **Material restraint.** Depth comes from tonal surfaces, alpha borders, inset rim light, and one low-energy ambient glow—not blur piles or heavy drop shadows.

## 2. Color

LeaseFlow is dark-mode native for this milestone. Semantic tokens are the only allowed color source in components.

| Role | CSS token | Value | Usage |
| --- | --- | --- | --- |
| Canvas/deep | `--lf-canvas-deep` | `#050807` | Atmospheric outer edge |
| Canvas | `--lf-canvas` | `#070b0a` | Page background |
| Surface/base | `--lf-surface-0` | `#0b110f` | Shell and bezel tray |
| Surface/primary | `--lf-surface-1` | `#101815` | Primary panels |
| Surface/secondary | `--lf-surface-2` | `#16211d` | Controls, nested regions |
| Surface/elevated | `--lf-surface-3` | `#1c2a25` | Hover, selected, popover |
| Surface/disabled | `--lf-surface-disabled` | `#121916` | Disabled control fill |
| Text/primary | `--lf-text-1` | `#f4fbf7` | Headings and body |
| Text/secondary | `--lf-text-2` | `#b6c7bf` | Supporting copy |
| Text/tertiary | `--lf-text-3` | `#82978d` | Metadata and placeholders |
| Text/disabled | `--lf-text-disabled` | `#9aaca3` | Disabled and loading labels; remains ≥4.5:1 on disabled surfaces |
| Border/subtle | `--lf-border-subtle` | `rgba(214, 255, 235, 0.07)` | Quiet internal division |
| Border/default | `--lf-border` | `rgba(214, 255, 235, 0.13)` | Controls and panel edges |
| Border/strong | `--lf-border-strong` | `rgba(214, 255, 235, 0.23)` | Hover and active outline |
| Rim light | `--lf-rim-light` | `rgba(244, 255, 249, 0.12)` | Inset top highlight |
| Emerald/100 | `--lf-emerald-100` | `#d1fae5` | High-emphasis verified text |
| Emerald/200 | `--lf-emerald-200` | `#a7f3d0` | Focus and primary text-on-dark |
| Emerald/300 | `--lf-emerald-300` | `#6ee7b7` | Primary action fill |
| Emerald/400 | `--lf-emerald-400` | `#34d399` | Active line and verified icon |
| Emerald/500 | `--lf-emerald-500` | `#10b981` | Accent border and data mark |
| Emerald/700 | `--lf-emerald-700` | `#047857` | Pressed accent depth |
| Accent wash | `--lf-accent-wash` | `rgba(52, 211, 153, 0.10)` | Verified background layer |
| Accent border | `--lf-accent-border` | `rgba(110, 231, 183, 0.34)` | Focused/verified boundary |
| Status/success | `--lf-success` | `#6ee7b7` | Success icon and text |
| Status/warning | `--lf-warning` | `#fcd34d` | Warning icon and text |
| Status/error | `--lf-error` | `#fda4af` | Error icon and text |
| Status/info | `--lf-info` | `#93c5fd` | Informational icon and text |
| Warning wash | `--lf-warning-wash` | `rgba(252, 211, 77, 0.10)` | Warning surface |
| Error wash | `--lf-error-wash` | `rgba(253, 164, 175, 0.10)` | Error surface |
| Info wash | `--lf-info-wash` | `rgba(147, 197, 253, 0.10)` | Info surface |
| Scrim | `--lf-scrim` | `rgba(2, 7, 5, 0.72)` | Modal isolation only |
| Atmosphere/emerald | `--lf-atmosphere-emerald` | `rgba(16, 185, 129, 0.13)` | Static upper-right page light field |
| Atmosphere/cool | `--lf-atmosphere-cool` | `rgba(147, 197, 253, 0.06)` | Static lower-left balancing light field |

### Color rules

- Body text must meet WCAG 2.2 AA: 4.5:1 for normal text and 3:1 for large text and UI graphics.
- Status is never conveyed by color alone; pair the token with text and an icon or shape.
- Emerald is reserved for primary interaction, focus, and governed success. Candidate AI content stays neutral or informational until confirmed.
- Component files contain no raw hex, RGB, or HSL values. Add or revise the table first.
- Large green fills are prohibited. The perceptual ramp must appear through small signals, focus, controlled CTA fills, and rim accents.
- Atmosphere tokens are canvas-only and static. They never communicate state, sit behind text as the sole contrast layer, or animate.
- Unprefixed compatibility aliases (`--ink`, `--muted`, `--line`, `--green`, `--teal`, `--bg`) were removed. Legacy route classes remain temporarily scoped under `.lf-legacy-page`; new primitives must use only `--lf-*` tokens and `.lf-*` classes.

## 3. Typography

### Families

- Primary: `"Avenir Next", "Apple SD Gothic Neo", "Noto Sans KR", ui-rounded, sans-serif`. Avenir gives the rounded geometric warmth of the chosen Supabase reference; Apple SD Gothic Neo/Noto Sans KR preserve Korean legibility.
- Mono: `"SFMono-Regular", "Cascadia Code", "Roboto Mono", ui-monospace, monospace`. Mono is limited to IDs, revisions, dates, provenance, and numeric data.
- No display serif. Operational scan speed outranks real-estate editorial convention.

### Scale

| Role | Token | Size | Weight | Line-height | Tracking | Usage |
| --- | --- | --- | --- | --- | --- | --- |
| Display | `--lf-type-display` | `clamp(2.25rem, 5vw, 4.5rem)` | 400 | 1.00 | -0.035em | Showcase or major task title only |
| H1 | `--lf-type-h1` | `clamp(1.75rem, 3vw, 2.25rem)` | 400 | 1.12 | -0.025em | Page title |
| H2 | `--lf-type-h2` | `1.5rem` | 450 | 1.25 | -0.018em | Region title |
| H3 | `--lf-type-h3` | `1.125rem` | 500 | 1.35 | -0.01em | Card title |
| Body/large | `--lf-type-body-lg` | `1.0625rem` | 400 | 1.6 | 0 | Introductory copy |
| Body | `--lf-type-body` | `1rem` | 400 | 1.55 | 0 | Default text and controls |
| Body/small | `--lf-type-body-sm` | `0.875rem` | 400 | 1.5 | 0 | Secondary rows and metadata |
| Label | `--lf-type-label` | `0.75rem` | 600 | 1.35 | 0.08em | Uppercase technical labels |
| Data | `--lf-type-data` | `0.8125rem` | 500 | 1.45 | 0.02em | IDs, audit timestamps, numeric facts |

### Typography rules

- Body and controls never fall below 14px; the 12px label is uppercase, short, and never used for essential prose.
- Headings use regular or medium weight. Scale, rhythm, and contrast establish hierarchy; 700+ weight is prohibited.
- Operational numbers use tabular figures. Long IDs use `overflow-wrap: anywhere` and remain copyable.
- Korean and English may coexist without forced uppercase; uppercase is limited to short Latin technical labels.
- Readable prose is capped at 68ch. Dense data may use the full work surface.

## 4. Spacing & Layout

### Spacing scale

The base unit is 4px.

| Token | Value | Intent |
| --- | --- | --- |
| `--lf-space-1` | 4px | Hairline alignment and icon gap |
| `--lf-space-2` | 8px | Tight cluster |
| `--lf-space-3` | 12px | Compact row |
| `--lf-space-4` | 16px | Default control/card gap |
| `--lf-space-5` | 20px | Comfortable group |
| `--lf-space-6` | 24px | Panel padding |
| `--lf-space-8` | 32px | Region gap |
| `--lf-space-10` | 40px | Major internal break |
| `--lf-space-12` | 48px | Section separation |
| `--lf-space-16` | 64px | Desktop page breathing room |
| `--lf-space-20` | 80px | Showcase-only macro rhythm |

### Geometry and layout tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--lf-content-max` | 1280px | Admin content limiter |
| `--lf-copy-max` | 68ch | Prose measure |
| `--lf-control-min` | 44px | Minimum pointer/touch target |
| `--lf-row-compact` | 48px | Dense operational row floor |
| `--lf-radius-sm` | 8px | Inline chip and compact control |
| `--lf-radius-md` | 12px | Inputs and secondary controls |
| `--lf-radius-lg` | 18px | Inner work surface |
| `--lf-radius-xl` | 24px | Governance bezel outer tray |
| `--lf-radius-pill` | 999px | Status and primary island action |
| `--lf-icon-sm` | 16px | Inline status glyph |
| `--lf-icon-md` | 20px | Control glyph |
| `--lf-icon-lg` | 24px | Region glyph |

### Grid and responsiveness

- Content uses a 12-column conceptual desktop grid, `32px` desktop gutters, `24px` tablet gutters, and `16px` mobile gutters.
- Required QA widths: 375px, 768px, and 1280px. Page-frame changes may use media queries; primitives prefer intrinsic sizing and container queries.
- Use `repeat(auto-fit, minmax(min(16rem, 100%), 1fr))` for repeatable panels so unbroken content cannot force horizontal overflow.
- At 375px, primary content is one readable column with no horizontal scroll. Secondary metadata wraps or moves below the primary label.
- At 200% zoom, all actions and state descriptions remain reachable without two-dimensional scrolling.
- Full-height shells use `100dvh`/`100dvb`; never `100vh` or `h-screen`.
- For a fixed shell, the work body is the named scroll owner and must have `min-block-size: 0; overflow: auto`. Nested scrollbars require an explicit job.

### Spatial primitives

- `stack`: vertical rhythm with tokenized gap.
- `cluster`: wrapping action/tag row; it wraps before overflow.
- `content-limiter`: max 1280px with fluid inline gutters.
- `switcher`: equal regions that stack intrinsically when their content floor is reached.
- `workflow-rail`: an explicit four-column ordered progression on desktop, a 2×2 grid at tablet widths, and a vertical stack at mobile widths.
- `governance-bezel`: outer tray plus inner surface; it is material styling, not an extra scroll owner.

## 5. Components

### `GovernanceSurface`

- **Structure:** semantic container → outer `.lf-surface` tray → inner `.lf-surface__core` work surface.
- **Variants:** `default`, `accent`, `subtle`.
- **Spacing:** inner padding `--lf-space-5` on mobile and `--lf-space-6` above 768px.
- **States:** default, hover when interactive, focus-within, selected/accent, disabled by composed content.
- **Accessibility:** caller chooses the correct landmark/heading relationship; no clickable `div`.
- **Motion:** interactive surfaces use micro transform/opacity/rim changes only.
- **Layout:** governance bezel; never owns scroll unless explicitly documented by the caller.

### `ActionButton`

- **Structure:** native `<button>` or `<a>` → label → optional nested circular trailing icon.
- **Variants:** `primary`, `secondary`, `ghost`, `danger`.
- **Spacing:** minimum 44px block size; `--lf-space-4` inline padding; pill radius for primary, medium radius for other variants.
- **States:** default, hover, active, focus-visible, disabled, loading. Loading preserves width and announces progress.
- **Accessibility:** native semantics, visible label, `aria-busy` for loading, `disabled` for unavailable actions, 3px focus outline with offset.
- **Motion:** 140ms press and 220ms affordance transitions using the system curves; only transform and opacity animate.
- **Layout:** cluster child. One primary button per task region.

### `StatusBadge`

- **Structure:** inline status dot/icon + visible text.
- **Variants:** `neutral`, `info`, `warning`, `success`, `error`.
- **Spacing:** `--lf-space-2` inline cluster with pill radius.
- **States:** status variants only; not interactive unless composed as a button.
- **Accessibility:** color is reinforced by icon/shape and text; use `role="status"` only for live changes.
- **Motion:** none for static state; live state may crossfade with reduced-motion fallback.
- **Layout:** wrapping cluster item.

### `SectionHeading`

- **Structure:** optional eyebrow → heading → description → optional action cluster.
- **Variants:** `page`, `section`, `compact`.
- **Spacing:** `--lf-space-2` internal stack and `--lf-space-5` before content.
- **States:** static.
- **Accessibility:** heading level is explicit; one `h1` per route; description remains under 68ch.
- **Motion:** none.
- **Layout:** stack with actions switching below content when space is constrained.

### `WorkflowStep`

- **Structure:** numbered/state glyph → title/copy → optional owner metadata.
- **Variants:** `pending`, `current`, `complete`, `blocked`.
- **Spacing:** compact row floor 48px with `--lf-space-3` gap.
- **States:** current uses accent line plus “Current” text; complete has verified icon/text; blocked has error text; never color alone.
- **Accessibility:** ordered-list semantics; current step uses `aria-current="step"`.
- **Motion:** verified transition may use a 220ms opacity/scale confirmation, disabled under reduced motion.
- **Layout:** workflow rail; four columns above 800px, 2×2 from 481–800px, and one column at 480px or below.

### `FeedbackPanel`

- **Structure:** semantic icon → title → recovery-oriented description → optional action.
- **Variants:** `loading`, `empty`, `success`, `error`, `info`.
- **Spacing:** `--lf-space-5` internal stack.
- **States:** all variants are persistent examples in the showcase; loading uses an opacity pulse only.
- **Accessibility:** `aria-live="polite"` for loading/success, `role="alert"` for errors, action describes recovery rather than “Try again” without context.
- **Motion:** loading pulse is 1.6s opacity-only and disabled for reduced motion.
- **Layout:** content-limited stack; never collapses to a blank frame.

### `DataFact`

- **Structure:** label → primary value → provenance/detail.
- **Variants:** `default`, `verified`, `candidate`.
- **Spacing:** compact stack with tabular/mono value support.
- **States:** verified and candidate include visible text labels in addition to color.
- **Accessibility:** definition-list semantics when grouped; IDs wrap anywhere; no tooltip-only content.
- **Motion:** none.
- **Layout:** intrinsic grid using the overflow-safe track contract.

## 6. Motion & Interaction

| Token | Duration | Curve | Usage |
| --- | --- | --- | --- |
| `--lf-motion-press` | 140ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Press feedback and icon shift |
| `--lf-motion-state` | 220ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Hover, focus, state crossfade |
| `--lf-motion-panel` | 360ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Panel/route emphasis |

- Motion must explain affordance or a state transition. Decorative ambient animation is prohibited.
- Animate only `transform`, `opacity`, and, for focus/hover material response, color/border-color. Never animate layout properties.
- Controls provide visible feedback within 100ms of input and remain interruptible.
- Disabled and loading controls retain fully opaque required state labels; distinction comes from the disabled surface, border, cursor, native state, and explicit copy rather than fading the entire control.
- Active buttons scale to 0.985; nested glyphs may translate by one spacing unit. No layout bounds change.
- `prefers-reduced-motion: reduce` removes transforms, pulses, and nonessential transitions while preserving instant state clarity.
- `prefers-contrast: more` strengthens borders and text separation without changing meaning.

## 7. Depth & Surface

Strategy: **mixed tonal-shift + alpha border + inset rim**, with no generic drop-shadow cards.

| Level | Recipe | Use |
| --- | --- | --- |
| Canvas | Deep canvas + two restrained radial light fields | Page atmosphere |
| Tray | `--lf-surface-0`, subtle outer border, 4px padding, XL radius | Governance bezel outer shell |
| Work surface | `--lf-surface-1`, default border, inset top rim, LG radius | Primary panel core |
| Raised state | `--lf-surface-2`, strong border, brighter rim | Hover, selected, nested control |
| Governed state | Accent wash + accent border + emerald mark | Verified/approved/published only |

- Backdrop blur is reserved for a future fixed overlay or fixed navigation surface. It is prohibited on scrolling panels.
- The page atmosphere uses static radial gradients; it does not animate.
- No arbitrary `box-shadow`. The only permitted shadow is the inset rim recipe expressed as a tokenized system surface.
- Large cards use concentric radii: 24px outer and 18px inner with a 4px tray gap.

## 8. Accessibility Constraints & Accepted Debt

### Inclusive personas and constraints

| Persona | Context | Pass condition |
| --- | --- | --- |
| Junior Data Steward | Keyboard-heavy source review; may be interrupted and resume later | Current stage, next action, candidate status, and recovery message are explicit without relying on memory or color |
| Senior Reviewer | Reviews provenance and performs consequential approval/publication | Evidence and version state remain adjacent to the action; focus order reaches the final action predictably; irreversible action is not visually confusable with reset |
| LM Manager | Situational mobile/field use, glare, one-handed input, time pressure | 44px targets, high contrast, concise state labels, and single-column reflow preserve task completion |
| Low-vision reviewer | 200% zoom or increased contrast | No two-dimensional scrolling for primary content; text and controls remain distinguishable and keyboard reachable |
| Motion-sensitive user | Reduced-motion preference | No pulse, transform, or entrance movement is required to understand status or operate the interface |

### Constraints

- Target WCAG 2.2 AA. Body contrast ≥4.5:1, large text and UI graphics ≥3:1.
- Every interactive element is keyboard reachable with an unmistakable `:focus-visible` state.
- Minimum target size is 44×44px with at least 8px between adjacent targets.
- Visible labels, headings, errors, and recovery actions are required; placeholder-only instructions are prohibited.
- Status, selection, and progress never rely on color alone.
- Semantic landmarks, ordered workflow steps, native buttons, `aria-current`, `aria-busy`, and live-region behavior are preferred over custom ARIA.
- Content survives 375px, 768px, 1280px, 200% zoom, long Korean/English labels, empty data, and unbroken IDs.
- Forced colors retain outlines and state labels. Reduced motion and increased contrast preferences are honored.

### Accepted debt

| Item | Location | Why accepted | Owner / Exit |
| --- | --- | --- | --- |
| None accepted | — | Accessibility or persona debt cannot be silently deferred | Record exact affected users, severity, fix, owner, and explicit user acknowledgement before accepting debt |
