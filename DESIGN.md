# LeaseFlow Design System

## 0. Research log

- 2026-07-18 redesign: the owner rejected the shipped dark developer-console language and the exposure of internal policy copy. The new direction is a calm global knowledge-work product for office teams.
- OMO frontend routing: existing-product redesign, then layout repair and perfection audit. Layer B references shortlisted Notion, Airtable, and Mastercard; Notion was selected for warm restraint and progressive disclosure. Airtable informed structured-data density only.
- UI/UX database: generic real-estate teal, display-serif, and dashboard-card recommendations were rejected because they reduce Korean scan speed and create an AI-template look. A documentation/knowledge-base palette and plain-language interaction guidance were retained.
- No product screenshots, brand layouts, or reference copy are reproduced. References inform hierarchy, density, and interaction grammar only.

## 1. Product atmosphere

LeaseFlow is a quiet, precise workplace for people who review property information, coordinate decisions, and prepare external material. It should feel credible in a global enterprise: warm paper canvas, crisp white work surfaces, strong typography, restrained blue actions, and clear editorial spacing.

The product is not a system console. The primary interface speaks about the user's work, not the implementation. Technical metadata exists only where it helps troubleshooting or review and is progressively disclosed.

### Principles

1. **Work, not policy.** Lead with the task, its current state, and the next useful action.
2. **Plain language.** Prefer “Review changes” over “candidate governance” and “Publish” over “server-authorized transition.”
3. **One clear next step.** Each task region has one dominant action; secondary and destructive actions stay quiet.
4. **Progressive disclosure.** IDs, version numbers, source references, and decision logs appear in secondary detail views, not page introductions.
5. **Calm structure.** Hierarchy comes from spacing, type, alignment, and subtle borders—not neon color, nested bezels, or card decoration.

## 2. Color

Semantic tokens are the only color source in components.

| Role | CSS token | Value | Usage |
| --- | --- | --- | --- |
| Canvas/deep | `--lf-canvas-deep` | `#ebe9e4` | Page edge and mobile browser surround |
| Canvas | `--lf-canvas` | `#f7f6f3` | Primary page background |
| Surface/base | `--lf-surface-0` | `#f0efeb` | Quiet grouped region |
| Surface/primary | `--lf-surface-1` | `#ffffff` | Main work surface |
| Surface/secondary | `--lf-surface-2` | `#f5f4f1` | Inputs, nested rows, secondary regions |
| Surface/elevated | `--lf-surface-3` | `#eceae5` | Hover and selected state |
| Surface/disabled | `--lf-surface-disabled` | `#f1f0ed` | Disabled controls |
| Text/primary | `--lf-text-1` | `#23211f` | Headings and body |
| Text/secondary | `--lf-text-2` | `#57534e` | Supporting copy |
| Text/tertiary | `--lf-text-3` | `#6a655f` | Metadata |
| Text/disabled | `--lf-text-disabled` | `#8c8780` | Disabled labels |
| Border/subtle | `--lf-border-subtle` | `rgba(35, 33, 31, 0.07)` | Quiet division |
| Border/default | `--lf-border` | `rgba(35, 33, 31, 0.11)` | Controls and panel edges |
| Border/strong | `--lf-border-strong` | `rgba(35, 33, 31, 0.20)` | Active and hover boundary |
| Rim light | `--lf-rim-light` | `rgba(255, 255, 255, 0.92)` | Subtle top highlight |
| Accent/100 | `--lf-emerald-100` | `#e8f1fb` | Informational wash |
| Accent/200 | `--lf-emerald-200` | `#cfe2f7` | Focus wash |
| Accent/300 | `--lf-emerald-300` | `#76a9df` | Secondary accent |
| Accent/400 | `--lf-emerald-400` | `#3f7fbd` | Focus and selected mark |
| Accent/500 | `--lf-emerald-500` | `#2563a6` | Primary action |
| Accent/700 | `--lf-emerald-700` | `#194b7d` | Pressed action |
| Accent wash | `--lf-accent-wash` | `rgba(37, 99, 166, 0.08)` | Selected background |
| Accent border | `--lf-accent-border` | `rgba(37, 99, 166, 0.30)` | Focus boundary |
| Success | `--lf-success` | `#287a4b` | Completed state |
| Warning | `--lf-warning` | `#9a5b14` | Attention state |
| Error | `--lf-error` | `#b33a3a` | Error state |
| Info | `--lf-info` | `#2d69a8` | Informational state |
| Warning wash | `--lf-warning-wash` | `rgba(154, 91, 20, 0.08)` | Warning surface |
| Error wash | `--lf-error-wash` | `rgba(179, 58, 58, 0.07)` | Error surface |
| Info wash | `--lf-info-wash` | `rgba(45, 105, 168, 0.07)` | Info surface |
| Scrim | `--lf-scrim` | `rgba(31, 29, 27, 0.42)` | Modal isolation only |
| Atmosphere/accent | `--lf-atmosphere-emerald` | `rgba(37, 99, 166, 0.06)` | Compatibility token; never decorative |

### Color rules

- Body contrast targets WCAG 2.2 AA. Status never relies on color alone.
- Blue is reserved for links, focus, selected navigation, and the primary action.
- Green means completed or ready. Amber means attention. Neither decorates neutral content.
- No gradients, dark console chrome, luminous borders, or large tinted panels.

## 3. Typography and voice

### Families

- Primary: `"SF Pro Text", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`.
- Data: the same family with tabular numerals. Monospace is limited to an explicitly opened technical detail.
- No display serif, forced uppercase, or letter-spaced technical labels in primary product UI.

### Scale

| Role | Size | Weight | Line-height | Usage |
| --- | --- | --- | --- | --- |
| Page title | `clamp(1.85rem, 3vw, 2.65rem)` | 650 | 1.14 | One task-oriented `h1` |
| Section title | `1.35rem` | 620 | 1.3 | Major region |
| Card title | `1rem` | 620 | 1.4 | Group title |
| Body large | `1.0625rem` | 400 | 1.65 | Short introduction |
| Body | `0.9375rem` | 400 | 1.6 | Default copy and controls |
| Small | `0.8125rem` | 450 | 1.5 | Secondary metadata |
| Label | `0.75rem` | 600 | 1.4 | Short sentence-case label |

### Content rules

- Page copy answers: What is this? What needs attention? What can I do next?
- Primary UI must not use: governed, control plane, server-side, adapter, mutation, optimistic concurrency, provenance, allowlisted, scoped patch, projection, sandbox-only, mock Outlook, or raw enum values.
- Use human labels: “Review changes,” “Current information,” “Decision history,” “Demo email,” and “Approve and send.”
- Show the demo boundary once per surface: “Demo data only. No email, phone, or sign-in connection.”
- Avoid explaining authorization and publication rules unless the user opens help or a relevant error occurs.
- Buttons start with a concrete verb. Success messages state the result and next step in one sentence.

## 4. Spacing and layout

Base unit is 4px. Standard gaps are 8, 12, 16, 24, 32, 48, and 64px.

| Token | Value | Usage |
| --- | --- | --- |
| `--lf-content-max` | `1240px` | Admin content limiter |
| `--lf-copy-max` | `62ch` | Prose measure |
| `--lf-control-min` | `44px` | Minimum action target |
| `--lf-row-compact` | `48px` | Dense row floor |
| `--lf-radius-sm` | `6px` | Tags and small controls |
| `--lf-radius-md` | `9px` | Buttons and inputs |
| `--lf-radius-lg` | `12px` | Main work surface |
| `--lf-radius-xl` | `16px` | Large grouped region |
| `--lf-radius-pill` | `999px` | Status only |

- Desktop uses a 12-column conceptual grid with 32px gutters; tablet 24px; mobile 16px.
- Required QA widths are 375, 768, and 1280px. Primary content must never require horizontal scrolling.
- Admin navigation remains compact and sticky only when it does not steal vertical workspace.
- Primary/secondary layouts use a wide work area and a 280–320px action rail. They stack before content becomes cramped.
- Repeated facts use intrinsic grids. Tables are reserved for real row comparison, not decorative metrics.
- On mobile, sections form one reading column and actions follow the content they affect.

## 5. Components

### Work surface (`GovernanceSurface` in code)

- Renders as one white surface with a whisper border and subtle four-layer ambient shadow.
- The existing code name is retained to avoid behavioral churn; no visible copy uses “governance.”
- No outer tray, double bezel, neon rim, or nested card decoration.
- Interactive states use border/color/opacity only. The surface never becomes a click target by accident.

### Mobile work queue

- Requests and weekly reports are lanes in one operating flow, not two dashboard cards. Only the selected lane is expanded.
- The queue is the navigation and orientation layer: lane name, human status, and selection state. It never repeats the full task description.
- Default selection follows work priority: stale or approved external material first, then items awaiting a decision, then drafts, then new work. A completed request yields to an unfinished weekly report.
- The expanded lane contains one current outcome, the evidence needed for that decision, and its next permitted action. Later steps stay hidden until the state machine permits them.
- On desktop the queue becomes a narrow rail beside the active work. On mobile it is a two-option tab row above the active work. Both use one shared surface rather than nested cards.
- Current property information is reference material and follows the active work. It does not compete with the task queue or primary action.

### Action button

- 44px minimum height, 9px radius, compact label, optional 16px trailing icon.
- Primary is restrained blue with white text. Secondary is white with a neutral border. Ghost is text-forward.
- One primary action per task region. Reset and destructive actions are visually separated.
- Loading preserves label width and exposes `aria-busy`; disabled reasons are explained near the task, not inside technical tooltips.

### Status badge

- Short sentence-case status with a small dot/icon. Examples: “Ready to review,” “Waiting for approval,” “Published.”
- Badges do not carry IDs, environment names, or implementation state.

### Section heading

- Optional quiet context line, concise heading, one-sentence description, optional action.
- Numbered technical eyebrows such as “03 / Role boundary” are prohibited in production UI.

### Workflow step

- Uses an ordered list with plain task names: “Source,” “Review,” “Approval,” “Published.”
- Current and completed states include visible text, not color alone.
- Desktop is four columns; tablet 2×2; mobile vertical.

### Data fact and candidate change

- Label → clear value → optional supporting detail.
- Before/after changes use “Previous” and “Suggested,” with values visually aligned.
- Source reference, confidence, and version ID live in a secondary disclosure. Confidence may be shown by default only when it materially helps review.

### Decision history

- Human-readable event label first, person and date second.
- Raw event keys, actor IDs, and storage metadata are not primary content.

## 6. Mobile product contract

- Mobile uses the same warm palette and typography, adapted for touch and outdoor readability.
- The opening view is a task queue, not a marketing hero or dashboard summary. Its first viewport must contain the next permitted action.
- The page title is 24–28px on mobile. Supporting copy is at most one short sentence and must never compete with the title.
- Requests and weekly reports appear before reference data. The active task names the outcome and places its action directly below it.
- Do not repeat the same workflow state in a hero, metric card, and task card. Do not show seeded or fallback counts when no actual task exists.
- Current property information uses familiar labels: available area, rent-free, parking support, and floor plan.
- Superseded files are silently excluded from packages. Mention them only in a relevant warning or history view.
- Internal labels such as `CONTROL PLANE`, revision, audit events, fixture, candidate patch, and confidential enum values are prohibited.
- A single boundary note is enough: “Demo data only. No email, phone, or sign-in connection.”
- Touch targets are at least 44×44px; actions are never arranged more than two abreast at 375px.
- System text scaling, reduced motion, increased contrast, and screen-reader labels must remain supported.

## 7. Motion and depth

- Motion explains input feedback or state change only. Use 140ms press and 220ms state transitions.
- Animate transform and opacity only; reduced-motion removes nonessential transitions.
- Page background is flat warm neutral. Work surfaces use a 1px border plus subtle layered shadows:
  `0 1px 1px rgba(31,29,27,.02)`, `0 2px 4px rgba(31,29,27,.025)`, `0 8px 24px rgba(31,29,27,.035)`, `0 20px 48px rgba(31,29,27,.025)`.
- Do not use glass blur, gradients, floating-card grids, or heavy shadows.

## 8. Accessibility and personas

| Persona | Context | Pass condition |
| --- | --- | --- |
| Data reviewer | Keyboard-heavy review with interruptions | Current task, next action, and recovery state are explicit without memory or color |
| Senior approver | Reviews consequential external material | Evidence is adjacent to approval and irreversible actions are clearly separated |
| Property manager | Mobile, glare, one-handed use, time pressure | Concise labels, 44px targets, and a single-column path preserve task completion |
| Low-vision user | 200% zoom or increased contrast | No two-dimensional primary-content scrolling; focus and state remain visible |
| Motion-sensitive user | Reduced motion | No movement is required to understand or use the product |

- Target WCAG 2.2 AA; every action is keyboard reachable with a visible focus state.
- Use landmarks, native controls, ordered workflow lists, live regions, and `aria-current` before custom ARIA.
- Test 375px, 768px, 1280px, 200% zoom, long Korean/English labels, loading, empty, error, and success states.
- No accessibility or persona debt is silently accepted.
