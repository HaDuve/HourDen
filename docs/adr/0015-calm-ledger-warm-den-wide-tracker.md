# Calm-ledger design direction: warm Den accent, fewer boxes, wide timeline Tracker

## Status

Accepted. Amends ADR-0012 (palette values and surface usage); keeps its token system, single dark theme, and top-nav + More navigation.

## Context

The October 2026 UI audit found the app correct and accessible after token fixes, but generic: every element sits in the same bordered gray card, blue serves as brand, action, and chart color at once, Project colors are stored but never shown, amounts are small gray meta text, and every screen uses a 768 px column that leaves most of a laptop screen empty. The product's job — turning tracked time into a **Sent** **Invoice** — is not visible in the design, and the three rhythms (track daily, review weekly, invoice monthly) are disconnected forms.

Three directions were considered: refine in place ("calm ledger"), make the Tracker timeline-first ("time canvas"), or rebrand with a distinct identity ("the Den").

## Decision

**Calm ledger as the foundation, the time canvas on desktop, and a light Den identity.**

1. **Fewer boxes.** Hierarchy comes from spacing and type scale, not borders. Bordered surfaces are reserved for inputs, overlays, and true containers (timer bar, Invoice preview). Lists become rows on the page background separated by hairlines; KPI cards lose their borders.
2. **One job per color.**
   - **Ember (amber)** is the brand and means *live / earning / primary action*: the primary button, the **Running Timer**, the **Live Counter**, and live earnings.
   - **Project colors** carry categorization (row markers, Day Ribbon blocks, chart series). The default Project palette excludes the ember hue so a Project never looks "live".
   - **Red** is only for destructive confirmation and errors, never resting UI.
   - Green is retired as the running accent and kept only for success feedback.
3. **Warm dark base.** Surfaces shift from cool blue-gray to warm near-black so ember reads as light in a den, not a warning. Starting values (all verified ≥ AA):

   | Token | Value | Check |
   |---|---|---|
   | `background` | `#0e0c0a` | — |
   | `surface` | `#16130f` | — |
   | `content` | `#ece6df` | 14.9:1 on surface |
   | `muted` | `#a89f94` | 7.1:1 on surface |
   | `primary` | `#f59e0b` | 8.6:1 on surface (as accent text) |
   | `primary-content` | `#1c1003` | 8.7:1 on primary |
   | `focus` | `#fcd34d` | 12.8:1 on surface |

4. **Money beside time.** Amounts sit next to durations at equal weight in the timer bar, day totals, and month header; not as a separate gray line.
5. **Display numerals.** Timer, durations, and amounts use one tabular display face (self-hosted, no third-party font CDN) so numbers are the visual anchor of every screen.
6. **Wide desktop Tracker.** On desktop the Tracker uses a wide container with the Day Ribbon / day timeline as the primary view and the entry list beneath or beside it. Form-heavy screens (Invoices, Clients, Projects, Report, Import, Onboarding) keep a readable column. Mobile layout is unchanged.
7. **The month is the backbone.** Tracker month headers, the Unbilled chip, and Close the Month connect tracking to invoicing; the Dashboard compares against the previous period.

## Considered options

- **Calm ledger only** — rejected as the whole answer: fixes noise but leaves the product without a point of view and wastes desktop width.
- **Full "Den" rebrand** (new logo, typeface system, illustration) — rejected for now: high cost for a solo operator; the warm accent and display numerals capture most of the identity at token level.
- **Keep blue** — rejected: blue is the default SaaS color and overloaded across brand, action, and charts.
- **Sidebar for the wide layout** — still rejected per ADR-0012; width goes to content, not navigation.

## Consequences

- One token-level palette change in `index.css`; screens that already use semantic tokens change automatically. Hard-coded chart colors and the default Project color must move off ember.
- `primary-content` becomes dark text; any component that assumed white-on-primary must use the token.
- The Running Timer accent changes from green to ember across Tracker, nav link, favicon, and document title chrome.
- Tracker gets a desktop-specific layout; tests that assert the 768 px container on Tracker need updating.
- Future rebrand work (logo, marketing) builds on these tokens rather than replacing them.
