# Dark semantic-token design system; top-nav retained (no sidebar)

## Status

Accepted

## Context

The App-MVP UX round adopts a design blueprint (derived from Clockify screenshots) that emphasizes layout, contrast, and responsiveness over a specific palette. Two structural questions fall out of it:

- **Styling foundation.** The app currently hardcodes light Tailwind utility colors (`neutral-*`, `slate-*`, `bg-white`, `#f8fafc` body) across every screen. The blueprint describes components in terms of semantic roles (`bg-surface`, `bg-background`, `bg-primary`, `text-primary-content`, `border-divider`) and a dark base. Restyling every screen with raw utilities would scatter color decisions and make a future palette change a full-app edit.
- **Navigation shape.** The blueprint assumes a left **sidebar** (`w-64` desktop / `w-16` tablet / mobile drawer or bottom bar). HourDen instead uses a top nav with a "primary (Tracker/Invoices) + More overflow" pattern, plus a mobile bottom bar (ADR-0011).

Tailwind v4 (CSS-first `@theme` in `index.css`) is already in place, React 19.1, React Router v7.

## Decision

**Adopt a dark, semantic-token design system.**

- Define named design tokens in Tailwind v4 `@theme` (`index.css`): `background`, `surface`, `surface-hover`, `surface-active`, `primary`, `primary-content`, `divider`, plus text-hierarchy conventions (high-contrast headings, muted `text-*` for meta). Screens reference tokens, not raw palette utilities.
- Ship a **single dark theme** — no light theme, no user toggle in this round. Palette values live in one place; a future palette or light-mode addition edits tokens, not screens.
- Time/numeric values use `font-mono` / `tabular-nums` to prevent layout shift as the timer ticks.
- Restyle **all screens** (Tracker, Clients, Projects, Report, Invoices, Import) plus the new Dashboard in this round for a consistent system.

**Keep the top-nav + More pattern — deliberately reject the blueprint's sidebar.**

- Retain the existing top nav (desktop) and bottom bar (mobile) from ADR-0011; Dashboard joins Tracker and Invoices as a primary destination, the rest stay under More.
- The blueprint's sidebar is treated as inspiration for layout/contrast, not a mandate for information architecture.

## Considered options

- **Restyle with raw Tailwind utilities, no tokens** — rejected: scatters color decisions across every screen; a palette change becomes a full-app find-and-replace; no single source of truth for surface/contrast.
- **Ship light + dark with a toggle now** — rejected for this round: adds persistence, a switcher, and double the visual QA for a solo operator who wants one dark UI.
- **Adopt the sidebar as drawn** — rejected: reworks a navigation IA that already solves the crowding problem (ADR-0011), for no functional gain; the top-nav + More pattern and mobile bottom bar already work responsively.

## Consequences

- One-time token setup in `@theme`; every screen is edited once to consume tokens and dark values.
- Future light mode or rebrand is a token-level change, not a screen-level rewrite.
- Deviation from the source blueprint (no sidebar) is intentional and recorded here so a future reader does not "fix" it back to a sidebar.
- A later light/dark toggle, if ever wanted, layers on top of the token system without touching screens.
