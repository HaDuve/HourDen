# Running Timer state for app-wide chrome

Research for [wayfinder #115](https://github.com/HaDuve/HourDen/issues/115) — how favicon, `document.title`, and Tracker nav get **Running Timer** state on every route.

## Problem

Today `TrackerPage` alone:

- fetches `GET /api/time-entries/running` on load
- holds `running` in local `useState`
- subscribes to `timer-changed` via `useWorkspaceEvents` to refetch

Chrome lives outside `TrackerPage` (`AppLayout`, `TrackerNavLink`, future favicon/title hooks). Those surfaces never see the timer.

## Constraints (existing architecture)

| Constraint | Source |
|------------|--------|
| Ticking is client-side from `startedAt` | ADR-0010, `useLiveCounter` |
| Cross-device sync is SSE invalidation, not payload push | ADR-0010 |
| `timer-changed` → refetch REST | `TrackerPage`, API `notifyRunningTimerChanged` |
| One Running Timer per Workspace | `CONTEXT.md` |
| All tabs show recording favicon when timer active | #111 resolution |

## Options considered

### A. Duplicate fetch + SSE per consumer

Each chrome hook independently calls `/running` and mounts `useWorkspaceEvents`.

**Rejected.** `useWorkspaceEvents` opens a new `EventSource` per mount (`useWorkspaceEvents.ts`). Two consumers ⇒ two SSE connections per tab. Wasteful; diverges from ADR-0010’s “one client hook” spirit.

### B. Global module store (Zustand / module singleton)

Module-level `running` + `subscribe`, one manual SSE setup.

**Rejected.** No existing global-state library; fights React patterns already used (`LocaleProvider`).

### C. `RunningTimerProvider` + multiplexed `useWorkspaceEvents` (recommended)

Two coordinated changes:

1. **Multiplex SSE** — one `EventSource` per tab, fan-out to all handler sets (refactor `useWorkspaceEvents` internals or add `WorkspaceEventsProvider` in `AppLayout`). TrackerPage and running-timer logic share the same connection.

2. **`RunningTimerProvider` in `AppLayout`** — mirrors `LocaleProvider` in `AuthenticatedApp`:
   - initial `GET /api/time-entries/running`
   - refetch on `timer-changed`
   - expose `{ running: TimeEntry | null, startedAt: string | null, refresh }` via context

Chrome and nav read `useRunningTimer()`; elapsed display still uses `useLiveCounter(startedAt)`.

### D. Push `startedAt` over SSE

Extend event payload with timer fields.

**Rejected.** ADR-0010 explicitly chose invalidation + refetch to avoid drift between push and REST paths. No API change needed.

## Recommendation

**Option C** — `RunningTimerProvider` at `AppLayout` + single multiplexed workspace-events connection.

### Placement

```
AuthenticatedApp
  LocaleProvider
    OnboardingGuard
      AppLayout                          ← RunningTimerProvider here
        AppNavigation (TrackerNavLink)   ← consumes useRunningTimer
        Outlet (pages)
```

Onboarding and `/login` stay outside — no chrome timer there.

### Provider contract

```ts
type RunningTimerContextValue = {
  running: TimeEntry | null;
  startedAt: string | null; // running?.startedAt ?? null
  refresh: () => Promise<void>;
};
```

- **Mount:** `refresh()` once.
- **`timer-changed`:** `refresh()` (all tabs, per #111).
- **Mutations on TrackerPage:** server already emits `timer-changed`; local tab refetches via SSE like remote tabs. Optional optimistic `setRunning` on start/stop is a polish, not required.

### SSE multiplexing

Minimal refactor: module-level registry in `useWorkspaceEvents.ts`:

- First subscriber opens `EventSource`; last unsubscribe closes it.
- Each `useWorkspaceEvents(handlers)` merges handlers into the registry.
- Existing tests updated to assert still one `MockEventSource` instance with multiple handler sets.

Alternative (heavier): `WorkspaceEventsProvider` + `useWorkspaceEvent(name, fn)`. Prefer registry refactor — smaller surface, keeps call sites unchanged.

### TrackerPage migration

| Today | After |
|-------|-------|
| Local `running` state | `useRunningTimer().running` |
| `fetchRunningTimer` in `load()` | Drop; provider owns fetch |
| `refreshRunningTimer` | `useRunningTimer().refresh` |
| `useWorkspaceEvents` `timer-changed` | Remove; provider handles |
| `useWorkspaceEvents` `today-changed` | Keep (entries list only) |

`load()` still fetches entries, projects, clients — not running timer.

### Chrome consumers (future tickets)

| Consumer | Inputs |
|----------|--------|
| Recording favicon (#111) | `running !== null` → toggle canvas dot |
| `document.title` (#113) | `useLiveCounter(startedAt)` + abbreviated formatter |
| Tracker nav (#114) | `useLiveCounter(startedAt)` when running, else `t("nav.tracker")` |

Each is a small hook in `apps/web/src/chrome/` (or similar) called from `AppLayout` / `TrackerNavLink`.

### API

No changes. `GET /api/time-entries/running` already returns `{ entry: TimeEntry | null }`.

### Tests

- `RunningTimerProvider.test.tsx` — initial fetch, refetch on `timer-changed`, context default
- Extend `useWorkspaceEvents.test.ts` — two hooks ⇒ one `EventSource`
- `TrackerPage.test.tsx` — wrap with provider; drop running-timer fetch from page mocks where provider supplies state

## Out of scope for this decision

- Extending SSE to Clients/Projects/settings (ADR-0010: refetch-on-navigate)
- Optimistic running state on TrackerPage mutations
- `today-changed` ownership (stays on TrackerPage for now)
