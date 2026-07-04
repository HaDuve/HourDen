# Session auth with workspace isolation (Phase 1 auth slice)

## Status

Accepted (implements auth deferred in ADR-0004; supersedes MVP auth notes in ADR-0001 and ADR-0003 Caddy basic auth for browser traffic)

## Context

HourDen shipped as a single-operator MVP: Caddy `basic_auth` on the vhost, optional `HOURDEN_API_KEY`, one seeded Workspace, and `getCurrentWorkspaceId()` returning a constant (ADR-0004). Invoice **Sender** identity and report **Calendar Timezone** came from env vars — fine for one person, wrong for isolated test workspaces or SaaS.

The next step is **Phase 1 auth**: real login, separate **User** accounts (operator + QA), workspace data isolation, path toward public signup (Phase 2 SaaS). SSO may follow later; the session model must not block it.

## Decision

**Authentication**

- **Server-side sessions**: random id in an httpOnly, Secure, SameSite cookie; `sessions` table in Postgres; 30-day sliding expiry; logout deletes the row.
- **Password login** Phase 1; OAuth/OIDC SSO added later as an alternate login path into the same session (IdP tokens used only during the handshake, not as the browser session).
- **Browser gate**: dedicated `/login` page; unauthenticated visitors do not see app chrome. Caddy `basic_auth` on the HourDen vhost is removed when this ships.
- **`HOURDEN_API_KEY` retained** for automation/CI/direct `:3001` access when set; middleware accepts valid session **or** API key. Production browser traffic uses sessions only.
- **`GET /api/health` stays public** but returns only `{ ok: true }` — no workspace or version info without auth.

**Users and provisioning (Phase 1)**

- `users` table: email (unique login identifier), password hash.
- Password policy: minimum 8 characters with at least one uppercase, one lowercase, and one digit.
- Operator account created by migration from env (`HOURDEN_OPERATOR_EMAIL`, `HOURDEN_OPERATOR_PASSWORD`).
- Additional accounts (e.g. QA) via CLI (`create-user`), not self-service signup.
- No public registration UI in Phase 1.

**Workspaces and memberships**

- `workspace_memberships(user_id, workspace_id, role)` from day one. Phase 1 uses `role = owner` only.
- Session stores `active_workspace_id`; `getCurrentWorkspaceId()` reads from session and validates membership. Default to the user's sole workspace on login. No workspace switcher UI until a User has two or more Workspaces.
- Existing Default Workspace and all data preserved on migration; operator gets an `owner` membership. QA gets a new empty Workspace via CLI.
- Phase 2 (SaaS): public signup creates User + Workspace; shared workspaces add Members with roles beyond `owner`.

**Workspace-scoped settings (replace global env for multi-tenant correctness)**

- **Invoice Sender** block on `workspaces` (name, address, tax, bank, contact) — copied into **Issuance Snapshot** at issue (ADR-0006). Migration seeds Default Workspace from today's env/`DEFAULT_INVOICE_OPERATOR`.
- **Calendar Timezone** (IANA) on `workspaces` for Today, Reports, and Clockify CSV day boundaries. Migration seeds from `HOURDEN_TIMEZONE`.

**Still deferred (Phase 2+)**

- Public signup, email verification, abuse controls.
- SSO providers.
- Workspace switcher UI (until needed), invites.
- **Invoice Sender** editing UI on a dedicated settings page (Phase 1 ships edit on the Invoices page instead).
- Membership roles beyond `owner` (`admin`, `member`, …).
- Billing, onboarding, marketing landing.

## Considered options

- **JWT in localStorage** — rejected: XSS token theft; not needed for same-origin SPA + API.
- **JWT in httpOnly cookie as sole session** — rejected: harder instant revocation; sessions table fits existing Postgres.
- **Caddy basic auth + app login (defense in depth)** — rejected: double password, blocks SaaS login page, duplicates secret management.
- **Invoice Sender on User** — rejected: sender identity is a business attribute of the **Workspace**, not the login record; one User may run multiple Workspaces later.
- **`owner_user_id` on workspaces only** — rejected: shared workspaces would require a later migration; memberships table is the stable model.
- **Drop `HOURDEN_API_KEY` entirely** — rejected: cheap escape hatch for CI/scripts without browser login.

## Consequences

- New tables: `users`, `sessions`, `workspace_memberships`; new columns on `workspaces` for Invoice Sender + timezone.
- `getCurrentWorkspaceId()` becomes session-aware (ADR-0004 seam fulfilled).
- `verify-production.sh` and deploy docs must use app login instead of Caddy basic auth.
- ADR-0006 consequence "Operator identity from env" applies only to migration seeding; live issue uses Workspace sender fields.
- Phase 2 SaaS plugs into the same session and membership model — not a rewrite.
