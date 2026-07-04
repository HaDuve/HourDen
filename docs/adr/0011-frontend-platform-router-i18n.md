# Frontend platform for the App-MVP UX round: routing and localization

## Status

Accepted

## Context

The App-MVP UX round adds responsive layout, a first-run **Onboarding** flow, a reworked navigation (Today + Invoices primary, the rest behind an overflow/"more" surface), en/de **Language** support, and better labels. Two of these need platform foundations the SPA does not have yet:

- **Navigation is `useState<Page>` in `App.tsx`** — no URLs, no browser back button, no deep links. Onboarding steps, an overflow menu, and mobile back-navigation all want real routes.
- **All strings are hardcoded English** with no message-catalog or formatting layer.

## Decision

**Routing — adopt React Router, Declarative mode.**

- Replace `useState<Page>` with React Router **v7** (`react-router-dom` 7.18.1) in **Declarative mode** (`BrowserRouter` + `Routes`/`Route`). No loaders/actions — data continues to come from the app's own `fetch`/SSE layer (ADR-0010).
- Caddy serves the static build with an **SPA fallback** so deep links resolve to `index.html`.
- **Deliberately not v8.** React Router v8 (current major, 8.x) requires Vite 7+ and Node 22.22+; the repo is on Vite 6 (ADR-0001). v7 runs on Vite 6 and covers every need here. Upgrading to **v8 + Vite 7 + Node** is recorded as a separate future item, not a prerequisite for this UX round.

**Localization — react-i18next, preference on the User.**

- Use **react-i18next** (with `i18next`) and lazy-loaded en/de JSON message catalogs; dates/numbers via `Intl` for the active locale (e.g. de: `1.234,56 €`, `DD.MM.YYYY`).
- **Language is a per-User preference**, stored on the `users` record (new nullable column) with a small `PATCH` endpoint, defaulted from browser `Accept-Language` on first login and cached in `localStorage` to avoid a wrong-language flash. It is **not** on the Workspace — language follows the person across devices, unlike **Calendar Timezone** and **Invoice Sender**, which are Workspace business attributes.
- **Scope is app UI only.** Issued **Invoice** PDFs and the Clockify CSV export keep their current language and format — out of scope for this round.

## Considered options

- **Keep `useState` navigation / hand-rolled onboarding steps** — rejected: no deep links, no back button, onboarding not resumable; reinvents routing.
- **React Router v8 now** — rejected for this round: drags in a Vite 6→7 and Node bump as a prerequisite, inflating a UX round into a build-tooling migration.
- **LinguiJS / hand-rolled i18n** — rejected: react-i18next is the mature default; hand-rolling reinvents plurals/interpolation/formatting.
- **Locale on the Workspace** — rejected: language is a person's preference, not a business attribute of the den; one User may run several Workspaces.

## Consequences

- New dep: `react-router-dom@7`; Caddy needs an SPA fallback route.
- New deps: `react-i18next` + `i18next`; a new `users` column + `PATCH` endpoint for Language; a language switcher in the UI.
- A future ADR/issue covers upgrading to React Router v8 (with Vite 7 + Node 22.22).
