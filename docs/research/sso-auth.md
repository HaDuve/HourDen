# SSO auth into HourDen (2026)

How to add OAuth/OIDC SSO without replacing Phase 1 session auth.

## Current stack (what SSO must plug into)

| Piece | Today |
| --- | --- |
| Web | Vite + React SPA, `/login` form → `POST /api/auth/login` |
| API | Hono on Node 20, `pg` Pool |
| Session | `hourden_session` httpOnly cookie, `sessions` table, 30-day sliding expiry |
| Users | `users.email` unique, `password_hash text NOT NULL`, CLI/`create-user` (no public signup) |
| Isolation | Session `active_workspace_id` + `workspace_memberships` (ADR-0009) |
| Edge | Caddy: `/api/*` → API, rest → SPA `index.html` |
| Automation | `HOURDEN_API_KEY` still accepted by middleware |

ADR-0009 already specified the target: OAuth/OIDC as an **alternate login path into the same session**. IdP tokens only during handshake — not as the browser session. JWT-as-session was rejected.

## What “SSO” means here (two products)

1. **Social / personal OIDC** (Google, GitHub, Microsoft): operator convenience. Fits Phase 1 if login is **invite-only** (link to an existing User; do not auto-create).
2. **Enterprise SSO** (per-workspace SAML or OIDC against Okta / Entra / Keycloak): SaaS Phase 2. Different product; do not build now.

This note sizes (1). (2) is weeks–months and a later ADR.

## 2026 protocol baseline

RFC 9700 (BCP for OAuth 2.0, Jan 2025) + OAuth 2.1 draft:

- Authorization Code flow. No implicit grant. No resource-owner password grant against the IdP.
- PKCE (`S256`) for all clients; RECOMMENDED even for confidential (server) clients.
- Exact `redirect_uri` match. No open redirects.
- CSRF: `state` and/or PKCE. OIDC: also `nonce`.
- Browser session stays first-party cookie. Do **not** put IdP access tokens in the SPA.

For a Vite SPA + same-origin API, the 2026-correct shape is **BFF**: the Hono API is the OAuth confidential client. Browser never sees client secret or IdP tokens.

Caddy already routes `/api/*` to Hono, so callback URLs under `/api/auth/.../callback` need **no Caddy change**.

## Options (2026)

### A. `openid-client` v6 on existing Hono routes — recommended

[openid-client](https://www.npmjs.com/package/openid-client) v6.8.7 (updated 2026-08-20). Certified OpenID Relying Party. Node 20 baseline matches `package.json`. ESM. Uses `oauth4webapi` under the hood.

Handshake only:

1. `GET /api/auth/oidc/:provider/start` — discovery, PKCE verifier + state in short-lived httpOnly cookies, 302 to IdP.
2. `GET /api/auth/oidc/:provider/callback` — `authorizationCodeGrant`, read email/`sub` from ID token, find User, `createSession`, set `hourden_session`, 302 `/`.
3. Discard IdP tokens. Do not persist refresh tokens unless a later feature needs Google APIs.

Fits ADR-0009, workspace isolation, API key path, existing tests. Adds one small dependency.

### B. Better Auth (Hono-native, social + generic OIDC) — too much auth replacement

Official [Hono mount](https://www.better-auth.com/docs/integrations/hono): `app.all("/api/auth/*", (c) => auth.handler(c.req.raw))`. Social providers (Google, GitHub, …) and [generic OAuth/OIDC](https://www.better-auth.com/docs/1.6/plugins/generic-oauth) (Entra, Okta, Keycloak, Auth0).

Own schema (`user`, `session`, `account`, `verification`) and session cookie. HourDen already has `users` / `sessions` plus **workspace** on the session. Migrating means dual schema, cookie cutover, and rewriting middleware that Better Auth does not know about (`active_workspace_id`, memberships, API key).

`disableSignUp` exists for email/password; social still needs careful account-linking config so Phase 1 does not become public signup. Fast if we had **no** auth yet. Expensive given ADR-0009 already shipped.

Do not use Better Auth’s **OAuth 2.1 Provider** plugin — that makes HourDen an IdP (MCP/third-party apps). Opposite direction.

### C. `@hono/oidc-auth` — wrong session model

Official Hono middleware on `oauth4webapi`. **Storage-less JWT cookie** as the session; refreshes against the IdP every 15 minutes; expiry default 1 day.

Conflicts with Postgres `sessions`, 30-day sliding expiry, logout-deletes-row, and workspace isolation. Google `GOCSPX-` secrets also need `client_secret_post` (`setClientAuth`). Reject for HourDen.

### D. `@hono/oauth-providers` — social-only, thin

Google/GitHub/etc. helpers. Handshake only (good), but provider-specific, not generic OIDC, and not the certified client. Fine for a one-off Google button; worse than A if we want Entra/Authentik later.

### E. Arctic — do not start new work on it

Deprecated July 2026 ([arcticjs.dev](https://arcticjs.dev/), [pilcrow announcement](https://pilcrowonpaper.com/blog/18)). Lucia already wound down. Example-only now.

### F. Auth SaaS (Clerk, Auth0, WorkOS) / self-hosted IdP in front

Clerk/Auth0/WorkOS: hosted IdP + SDKs. Fights ADR-0001 (self-hosted, no SaaS auth) and ADR-0009 (app owns sessions). WorkOS is the usual **enterprise SSO** buy later, not Phase 1.

Putting Authentik/Authelia/Keycloak **in front of** Caddy is edge SSO (another login before `/login`). Duplicate of what we already removed. Better as a **provider HourDen federates to** (option A with generic issuer), not a reverse-proxy gate.

## Recommended design (option A)

**Invite-only linking (Phase 1):**

- New table `user_identities (user_id, provider, subject)` unique on `(provider, subject)`.
- On callback: verified email from ID token → existing `users.email` → insert identity if new → `createSession` as today.
- Unknown email → 403, no User created. Matches Phase 1 CLI provisioning.
- Link only if IdP marks email verified (Google `email_verified`). Never link unverified emails (account-takeover).
- `password_hash` stays required until we explicitly allow SSO-only Users; then nullable + “set password” later.

**Public routes:** start + callback (and maybe a tiny error redirect). Middleware today only public-paths `POST /api/auth/login`. Must add GET start/callback.

**Login UI:** one button, full navigation to `/api/auth/oidc/google/start` (not `fetch`). Password form stays.

**Do not store IdP access/refresh tokens** unless a later feature needs Gmail/Drive. Login does not.

**Tests:** mock discovery + token + JWKS (or stub `openid-client`). Cases: happy path, unknown email, unverified email, bad state, expired PKCE cookie, existing identity.

**Ops:** Google Cloud OAuth Web client (or GitHub OAuth App). Redirect URIs:

- `http://localhost:<api-port>/api/auth/oidc/google/callback` (or the Vite-proxied API origin)
- `https://hourden.hannesduve.com/api/auth/oidc/google/callback`

Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `HOURDEN_PUBLIC_URL` for exact redirect. Secrets stay on the VM `.env`, not in the SPA.

## Effort

Assumes one IdP (Google or GitHub), invite-only, password login kept, existing session unchanged.

| Slice | Effort | Notes |
| --- | --- | --- |
| One provider, link-existing-only | **2–4 days** | Schema + 2 routes + login button + i18n + tests + Google console (human) |
| Second provider (same pattern) | **+0.5–1 day** | Config + button; shared callback helper |
| Generic OIDC issuer (Authentik/Entra) | **+2–3 days** | Discovery from `OIDC_ISSUER`; claims mapping |
| SSO-only Users (`password_hash` nullable) | **+0.5 day** | Migration + login still requires password **or** identity |
| Replace auth with Better Auth | **1.5–3 weeks** | Schema/session/middleware/tests; high regression risk |
| Enterprise per-workspace SAML/OIDC | **weeks–months** | Phase 2 SaaS; different ADR |

Biggest calendar delay is usually **IdP app verification** (Google “testing” vs “production”, redirect URI mismatch), not code.

## What not to do

- SPA public OAuth client + PKCE in the browser (tokens in JS).
- `@hono/oidc-auth` as the HourDen session.
- Better Auth as a drop-in without a session/workspace migration plan.
- Arctic for new code.
- Auto-signup from Google in Phase 1 (violates CLI-provisioned Users).
- Making HourDen an OAuth **provider**.

## Sources

- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html) — OAuth 2.0 Security BCP
- [openid-client v6](https://www.npmjs.com/package/openid-client) — certified RP, Node 20+, PKCE examples
- [Better Auth Hono](https://www.better-auth.com/docs/integrations/hono), [Google](https://www.better-auth.com/docs/authentication/google), [database schema](https://www.better-auth.com/docs/concepts/database)
- [Hono oidc-auth README](https://github.com/honojs/middleware/blob/main/packages/oidc-auth/README.md) — JWT cookie session
- [Arctic deprecation](https://arcticjs.dev/) (July 2026)
- ADR-0001, ADR-0009, `apps/api/src/auth/routes.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/db/migrations/012-auth.ts`
