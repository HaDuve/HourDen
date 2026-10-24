# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are freelancers who bill by the hour: Operators who track work day to day and turn that time into invoices at month end. The product is for freelancers in general — not a single private operator — including people who previously used Clockify (or similar) and want tracking and invoicing in one place. UI Language is English or German.

## Product Purpose

HourDen is the den for billable hours: log time as you go, keep Clients and Projects organized, and turn tracked time into PDF invoices without juggling separate tools. Success is a calm path from Running Timer / Manual Entry → Billable Complete → Preview → Issue → Prepare Email → Sent Invoice, with Workspaces isolated and issued work not double-billed.

## Positioning

Openly available software for freelancers that makes time tracking and invoicing easy in one private Workspace (“Hour” + “Den”). Differentiator: the month-end path is first-class — money sits beside time, readiness and unbilled state connect Tracker to Invoices — rather than being a stopwatch with a separate billing tool bolted on.

## Operating Context

Daily: start/stop the Running Timer or add Manual Entries on Tracker; Clients and Projects carry Billable Rates and colors. Weekly/monthly: Report for review; Invoices for Preview, Issue, PDF download, and Prepare Email (mailto + attach). Optional Clockify CSV Import for history. Workspace Calendar Timezone drives day boundaries; Invoice Sender and Recipient fields print on PDFs. Multi-device live updates keep one Running Timer per Workspace.

## Capabilities and Constraints

- Confirmed: Tracker, Clients, Projects, Report (CSV export), Invoices (preview/issue/sent/void path), Clockify Import, Dashboard, onboarding, EN/DE UI Language, session auth with Workspace isolation (Phase 1: no public self-service signup yet; SaaS signup planned).
- Domain terminology in `CONTEXT.md` is binding for product copy and tickets.
- Design system: dark theme tokens (ADR-0012); Warm Den direction — ember accent, fewer boxes, money beside time, wide desktop Tracker (ADR-0015).
- Contrast target: WCAG AA for content, muted, primary/primary-content, and focus.
- Undecided / future: public signup UX, multi-member Workspaces, marketing site identity beyond the app shell.

## Brand Commitments

- Name: **HourDen** — “your den for billable hours.”
- Voice: direct, operator-facing; prefer domain terms (Tracker, Client, Project, Running Timer, Billable Complete, Invoice, Sent) over soft synonyms.
- No separate marketing brand system committed yet; app identity follows ADR-0015 until a rebrand brief says otherwise.

## Evidence on Hand

- Live app: https://hourden.hannesduve.com
- Product/domain authority: `README.md`, `CONTEXT.md`, `docs/adr/` (esp. 0012, 0015)
- Do not fabricate testimonials, customer logos, benchmarks, or pricing claims.

## Product Principles

1. **Time becomes an Invoice** — every screen should make the money path legible, not hide amounts as gray meta.
2. **The month is the backbone** — daily tracking, period review, and month-end close are one story.
3. **One Workspace den** — calm, private, trustworthy; Operator language and isolation over team-SaaS chrome.
4. **Fewer boxes, clearer work** — hierarchy from type and spacing; color has one job (live/ember vs Project vs destructive).
5. **Domain words win** — use CONTEXT.md terms; don’t invent parallel UI vocabulary.

## Accessibility & Inclusion

WCAG AA contrast for text and focus. Keyboard and screen-reader operability for dialogs, sheets, and suggestion lists is a product requirement (tracked separately). EN/DE UI Language must remain coherent for dates and currency display.
