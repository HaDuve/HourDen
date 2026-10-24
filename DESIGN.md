---
name: HourDen
description: Warm dark den for billable hours — ember for live money, ledger for the month
colors:
  background: "#0e0c0a"
  surface: "#16130f"
  surface-hover: "#1e1a15"
  surface-active: "#28221c"
  primary: "#f59e0b"
  primary-content: "#1c1003"
  focus: "#fcd34d"
  secondary: "#1c1814"
  secondary-hover: "#2a241e"
  secondary-content: "#d4cbc0"
  secondary-border: "#4a4036"
  input: "#14110e"
  input-border: "#6b5f52"
  divider: "#2e2822"
  content: "#ece6df"
  muted: "#a89f94"
  danger: "#f87171"
  destructive: "#dc2626"
  destructive-content: "#ffffff"
  destructive-hover: "#b91c1c"
  destructive-border: "#7f1d1d"
  destructive-muted: "#2a1212"
  chart-1: "#3b82f6"
  chart-2: "#34d399"
  chart-3: "#a78bfa"
  chart-4: "#f472b6"
  chart-5: "#38bdf8"
  chart-6: "#22d3ee"
typography:
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title-large:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
  label-compact:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
  numeric:
    fontFamily: IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.5rem"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-content}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "#d97706"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-content}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.content}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.content}"
    rounded: "{rounded.md}"
    padding: "1rem"
---

# Design System: HourDen

## Overview

**Creative North Star: "The Operator's Den"**

HourDen is a private workshop for freelancers who turn tracked time into Sent invoices. The visual world is a warm dark den: ember light for anything *live and earning*, quiet hairlines for the ledger of the month, and Project color only for categorization — never competing with the brand accent. Hierarchy comes from type scale and spacing, not nested boxes.

This file records the **ADR-0015 Warm Den target** (accepted direction). Issue #189 lands the palette, accent, numeric face, fewer-boxes surfaces, and wide desktop Tracker; polish tickets treat this document as normative.

**Key Characteristics:**
- Warm near-black surfaces; ember (`#f59e0b`) as the single brand/live accent
- Hairline-separated rows on the page background; borders reserved for inputs, overlays, timer bar, Invoice preview
- Money beside time at equal weight; tabular numerals as the visual anchor
- Wide desktop Tracker; readable column on form-heavy screens
- Flat tonal depth — no ambient card shadows

## Colors

A warm dark ledger palette: ember is rare and means live; neutrals carry the rest.

### Primary
- **Ember** (#f59e0b): Primary actions, Running Timer / Live Counter, live earnings only. `primary-content` (#1c1003) for text on ember fills.

### Secondary
- **Warm Ink** (#1c1814 / #d4cbc0 / #4a4036): Outline and secondary controls; never compete with ember.

### Neutral
- **Den Black** (#0e0c0a): Page background
- **Den Surface** (#16130f): Raised panels when a true container is required; hover/active steps warm upward
- **Parchment** (#ece6df): Body and headings
- **Ash** (#a89f94): Meta, secondary labels, settled amounts
- **Hairline** (#2e2822): Dividers between rows
- **Focus Gold** (#fcd34d): Keyboard focus ring only

### Status
- **Danger Red** (#dc2626 / #f87171): Destructive confirmation and errors only — never resting chrome

### Charts
- Series tokens exclude ember so Project/chart color never reads as “live.” Use Project colors on Tracker/Dashboard when available.

### Named Rules
**The One Ember Rule.** Ember marks live/earning/primary action only. Settled amounts, chips, and charts stay content, muted, or Project color.

**The Fewer Boxes Rule.** Prefer hairline rows on `background` over bordered `surface` cards. Borders stay on inputs, overlays, the timer bar, and the Invoice preview.

## Typography

**Display / Numeric Font:** IBM Plex Mono (self-hosted woff2, no third-party CDN) — tabular figures for timers, durations, and amounts. Not a system display costume (Impact, Arial Black).
**Body Font:** Inter (with system-ui fallbacks) — incumbent UI sans until a deliberate type pairing replaces it.

**Character:** Quiet operator UI. Numbers carry the drama; labels stay medium-weight and short.

### Hierarchy
- **Title** (600, 1.875rem, tight tracking): Page titles on primary screens (one size — #186)
- **Body / Label** (400–500, 0.875rem): Controls, lists, forms
- **Label compact** (500, 0.75rem / `text-xs`): Mobile bottom-nav labels under icons
- **Numeric** (tabular, mono or display face): timers, durations, amounts — `tabular-nums`, no layout shift on tick

### Named Rules
**The Numbers Lead Rule.** Duration and money use the numeric face at content weight; never bury amounts as tiny muted footnotes when they sit beside time.

## Layout

Operate density: tight groups, generous section breaks. Default readable column for Clients, Projects, Report, Invoices, Import, Onboarding. **Desktop Tracker is wide** — Day Ribbon / timeline primary below the timer bar; entry list beneath or beside. Mobile keeps compact day-header ribbons. Spacing rhythm from Tailwind-scale steps (`0.5rem` / `1rem` / `1.5rem`). Prefer `scrollbar-gutter: stable` on `html`.

## Elevation & Depth

Flat by default. Depth is tonal (background → surface → hover) and hairline dividers — not ambient shadows. Overlays may use a dimmed backdrop; do not invent soft glow halos as decoration.

### Named Rules
**The Flat-By-Default Rule.** No card drop shadows. If a shadow appears, it is a state response (focus attention), not resting structure.

## Shapes

Gentle, utilitarian corners: `0.375rem`–`0.5rem` on controls and true containers. Lists after #189 are borderless rows — no rounded list chrome required. Project identity is a **small swatch/dot**, never a thick colored left border.

## Components

Quiet, restrained controls. Primary is ember with dark ink text; secondary is warm outline.

### Buttons
- **Shape:** medium radius (`0.5rem` primary / `0.375rem` secondary)
- **Primary:** ember fill, dark `primary-content`, medium label weight
- **Secondary:** warm border + secondary fill; hover lifts surface
- **Destructive:** red fill or outline — only for confirm-destroy paths; resting rows use quiet delete + Undo toast, not loud red outline buttons

### Cards / Containers
- **Default:** none — hairline rows on page background
- **True containers:** timer bar, Invoice preview, overlays — bordered surface, modest radius, internal padding `1rem`
- **KPI / Dashboard totals:** ledger rows, not a same-size hero-metric card grid

### Inputs / Fields
- **Style:** input fill + visible border (`input-border`); text `content`
- **Focus:** 2px `focus` outline, 2px offset
- **Running-field accent:** ember-tinted border/muted fill only while the Running Timer context applies

### Navigation
Top nav + mobile More sheet (ADR-0012). Ember marks the Tracker destination only while a timer is running. Visible text labels on mobile destinations.

### Signature: Money Clock / Live Counter
Live duration and live earnings sit side by side in the timer bar at equal weight; ember on the live pair only. Unbilled month chip uses content/muted amounts.

### Signature: Day Ribbon
Horizontal day timeline in Project colors; running block grows with the Live Counter in ember. Compact on day headers until wide Tracker layout lands.

## Do's and Don'ts

### Do:
- **Do** use ember for Running Timer, live earnings, and primary actions only.
- **Do** put amounts beside durations with tabular numerals.
- **Do** separate list rows with hairlines on the page background.
- **Do** mark Projects with a swatch/dot and use Project colors in the Day Ribbon and stacked charts.
- **Do** keep Invoice preview and inputs as bordered surfaces.

### Don't:
- **Don't** use progress rings, donuts, or sparklines as readiness costume.
- **Don't** ship hero-metric KPI card strips (big number + small label + delta) as page structure.
- **Don't** use a >1px colored `border-left` / `border-right` on rows or cards.
- **Don't** paint settled money or chart series in ember.
- **Don't** restore green as the running accent.
- **Don't** load display fonts from a third-party CDN — self-host only.
