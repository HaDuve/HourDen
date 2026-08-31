# Sign in with Apple — web-only requirements for HourDen (2026)

Research for [What does Sign in with Apple require for HourDen on the web?](https://github.com/HaDuve/HourDen/issues/160) — Apple Developer setup for **web-only** HourDen at `hourden.com`, alongside Google SSO at public launch.

Builds on [`docs/research/sso-auth.md`](sso-auth.md) (BFF via Hono + `openid-client`, same session model).

## Answer (launch checklist)

| Item | Requirement | HourDen implication |
| --- | --- | --- |
| **Apple Developer Program** | Paid membership ($99/yr) | Prerequisite for all identifiers and keys |
| **Primary App ID** | iOS/macOS/tvOS/watchOS App ID with Sign in with Apple enabled **as primary** | Create e.g. `com.hourden.app` even with no native app; groups the Services ID. Account Help only requires a registered primary App ID; one Apple doc page still says “App Store app” — treat **registered primary App ID** as sufficient; consent screen shows a **placeholder icon** until a shipped app exists |
| **Services ID** | Separate identifier; this is OAuth `client_id` for web | e.g. `com.hourden.web`; enable Sign in with Apple; group under primary App ID |
| **Private key (.p8)** | Sign in with Apple key tied to primary App ID; max **two** keys per primary app | Download once; store in VM `.env` (never commit). Key ID (`kid`) goes in JWT header |
| **Domains & return URLs** | Register on Services ID; exact match required | `hourden.com` + `https://hourden.com/api/auth/oidc/apple/callback`. Limits: 10 URLs (individual) / 100 (organization). **No file upload** needed for domain registration (Account Help, 2026) |
| **Redirect URI constraints** | Absolute HTTPS URL; scheme + host + path; **no** `localhost`, IP, or `#` fragment | Local dev cannot use Apple callback on `localhost`. Use production/staging domain, or defer Apple button in local dev |
| **Client secret** | **Not** a static string — ES256 JWT signed with `.p8` | Generate at **runtime** (`jose` or similar): `iss` = Team ID, `sub` = **Services ID**, `aud` = `https://appleid.apple.com`, `kid` in header. Max lifetime **15777000 s (~6 months)**. Token endpoint uses `client_secret_post` |
| **OIDC discovery** | Issuer `https://appleid.apple.com` | Fits `openid-client` v6; validate ID token `iss` against `appleid.apple.com` (June 2025 discovery glitch resolved) |
| **Scopes** | `openid email name` (space-separated) | **`name` + full `user` object only on first authorization** for that user/app group; persist immediately. Email always in ID token thereafter (may be private relay) |
| **Private relay email** | Users may get `@privaterelay.appleid.com` | Store as normal `users.email`; unique constraint applies. HourDen v1 has **no server-sent mail** (`mailto:` only) → **Private Email Relay domain registration not required at launch** |
| **Server-to-server notifications** | TLS 1.2+ HTTPS endpoint on **primary App ID** | **Mandatory from 2026-01-01 only for developers based in Republic of Korea** when registering/updating Services IDs. Optional elsewhere but recommended for account-delete / relay-preference changes. **Defer post-launch** unless operator is Korea-based |
| **Human setup ticket** | Console work before code ships | Maps to [#163 — Register Sign in with Apple for hourden.com](https://github.com/HaDuve/HourDen/issues/163) (blocked by #158 identity rules) |

**Effort vs Google at launch:** Same BFF route shape as Google (+0.5–1 day code once #158 lands). **Calendar risk is higher:** four console artifacts (App ID, Services ID, key, domain URLs) vs one Google OAuth client; dynamic client secret; first-login name capture; doc ambiguity on App Store vs App ID. **Not a launch blocker** if primary App ID + Services ID are created before cutover.

**Blockers:** (1) Apple Developer Program enrollment; (2) `hourden.com` live for registered return URL; (3) #158 decisions on auto-create, relay emails, and first-login name persistence.

---

## Apple Developer console setup (ordered)

1. **Enroll** in [Apple Developer Program](https://developer.apple.com/programs/) (Account Holder or Admin for identifier changes).

2. **Create primary App ID** (Identifiers → App IDs → +):
   - Description: `HourDen`
   - Bundle ID: e.g. `com.hourden.app` (explicit)
   - Enable **Sign in with Apple** → **Enable as primary App ID**
   - Optionally configure server-to-server notification URL here (required for Korea-based accounts from 2026-01-01)

3. **Create Sign in with Apple key** (Keys → +):
   - Name: e.g. `HourDen Sign in with Apple`
   - Enable Sign in with Apple → Configure → select primary App ID
   - Register → **download `.p8` once** (cannot re-download)
   - Note **Key ID** (`kid`)

4. **Create Services ID** (Identifiers → Services IDs → +):
   - Description: `HourDen Web`
   - Identifier: e.g. `com.hourden.web` → this is **`client_id`**
   - Enable Sign in with Apple → Configure:
     - Primary App ID: `com.hourden.app`
     - **Domains and Subdomains:** `hourden.com`
     - **Return URLs:** `https://hourden.com/api/auth/oidc/apple/callback`
   - Save

5. **Env on VM** (after #158 implementation):
   ```
   APPLE_CLIENT_ID=com.hourden.web          # Services ID
   APPLE_TEAM_ID=<10-char Team ID>
   APPLE_KEY_ID=<10-char Key ID>
   APPLE_PRIVATE_KEY=<contents of .p8, or base64>
   ```
   Do **not** paste a long-lived static JWT into env — generate per token exchange in API process.

---

## Technical integration (HourDen BFF)

Recommended path from `sso-auth.md` — **do not** use Apple JS in the SPA as the OAuth client. Server-side Authorization Code + PKCE:

```
GET  /api/auth/oidc/apple/start     → 302 appleid.apple.com/auth/authorize
GET  /api/auth/oidc/apple/callback  → code exchange, find/create User, createSession
```

| Parameter | Apple value |
| --- | --- |
| Issuer / discovery | `https://appleid.apple.com` |
| Authorize | `https://appleid.apple.com/auth/authorize` |
| Token | `https://appleid.apple.com/auth/token` |
| JWKS | `https://appleid.apple.com/auth/keys` |
| `client_id` | **Services ID** (not App ID) |
| `client_secret` | ES256 JWT (see above) |
| Token auth method | `client_secret_post` |
| `response_mode` | `query` (default BFF redirect) or `form_post` if using Apple JS popup |

**`openid-client` v6:** Use Apple as custom issuer; supply dynamic `client_secret` callback (JWT minted with `jose`). Same PKCE + `state` cookies as Google route.

**First-login name:** Apple returns `user: { name, email }` only once. Callback must persist `given_name` / `family_name` (or display name) to `users` on **create**; subsequent logins rely on ID token email + stored profile.

**ID token claims (typical):** `sub` (stable per Services ID), `email`, `email_verified`, `is_private_email` (when relay used). Use `sub` in `user_identities (provider='apple', subject)`.

**Real User Indicator / `real_user_status`:** Available on **native** flows; web OAuth does not expose the same signal. Do not rely on it for web signup abuse scoring (#157).

---

## Client secret rotation

Apple caps JWT `exp − iat` at **15777000 seconds** (~180 days). Expired secrets cause `invalid_client` with no warning.

**Required approach:** Mint a fresh JWT on each token request (or cache ≤24h in memory). Implementation cost: ~20 lines with `jose` + `.p8` from env. **Do not** store a six-month JWT in `.env` or rely on calendar reminders.

If the `.p8` key is rotated in Developer portal: update `APPLE_KEY_ID` + `APPLE_PRIVATE_KEY`; old key can be revoked after cutover.

---

## Private relay (@privaterelay.appleid.com)

When the user chooses **Hide My Email**, Apple returns a relay address in the ID token. It is stable for that user + developer team.

| Concern | HourDen v1 |
| --- | --- |
| Login / uniqueness | Treat relay address as the user's email; `users.email` unique |
| Outbound email delivery | Apple requires [Private Email Relay registration](https://developer.apple.com/help/account/configure-app-capabilities/configure-private-email-relay-service) (SPF/DKIM on sending domain) for **your server** to reach relay inboxes |
| HourDen invoice mail | **Out of scope** — Prepare Email uses `mailto:` in the Operator's client, not HourDen SMTP → relay registration **not needed at launch** |
| Re-auth after relay change | Server-to-server `email-enabled` / `email-disabled` notifications (optional endpoint) |

---

## Server-to-server notifications

Register one HTTPS URL on the **primary App ID** (not Services ID). Apple POSTs signed JWS events:

| Event | Meaning |
| --- | --- |
| `email-enabled` | User turned on relay forwarding — new relay address in payload |
| `email-disabled` | Stop emailing that relay |
| `consent-revoked` | User revoked Sign in with Apple for the app group |
| `account-delete` | User deleted app account (your side) |
| (Apple Account deletion) | Permanent Apple ID deletion |

Validate JWS with Apple public keys; handle idempotently.

**Regulatory:** From **2026-01-01**, developers **based in Republic of Korea** must provide the endpoint when registering/updating Services IDs ([Apple Developer News](https://developer.apple.com/news/?id=j9zukcr6)). Developers in other regions are not required; Apple recommends integration anyway.

**Recommendation for HourDen launch:** Skip S2S endpoint in v1 unless operator is Korea-based; add post-launch if HourDen gains server-sent email or strict GDPR-style delete propagation.

---

## Web-only without a shipped iOS app

Apple's docs disagree:

| Source | Wording |
| --- | --- |
| [Configure Sign in with Apple for the web](https://developer.apple.com/help/account/configure-app-capabilities/configure-sign-in-with-apple-for-the-web/) (Account Help) | Associate website with existing **primary App ID** — no App Store mention |
| [Configuring your environment](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple) | Requires "existing app **in the App Store**" |

Community + Account Help imply **registered primary App ID is enough** for web OAuth; the App Store line describes the typical case. Consent UI shows a **generic placeholder** instead of an App Store icon ([Stack Overflow / Apple forums](https://developer.apple.com/forums/thread/836711)).

**Risk:** If Apple Support enforces App Store literally, web Sign in with Apple would be blocked until any minimal app listing exists. Mitigation: create primary App ID now; escalate to Apple DTS only if Services ID configuration is rejected.

---

## Local development

Apple rejects redirect URIs that use `localhost`, bare IP, or fragments ([Configuring your webpage](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple)).

Options:

1. **Hide Apple button in dev** — test Google + password locally; verify Apple on staging/production only (simplest).
2. **Register a staging return URL** on the same Services ID (counts toward URL quota) — e.g. `https://hourden.com/...` only.
3. **Tunnel** — ngrok/custom domain pointing at local API (extra console URL slot).

Do not register `http://localhost:...` — Apple requires HTTPS domain names.

---

## Effort estimate (alongside Google)

Assumes #158 locked: public auto-create, `user_identities`, nullable `password_hash`.

| Slice | Effort | Notes |
| --- | --- | --- |
| Apple console setup (human) | **1–2 h** | App ID + Services ID + key + domain URLs; blocked until `hourden.com` DNS/Caddy live |
| API: dynamic client secret helper | **2–4 h** | `jose` + env; unit test JWT shape |
| API: Apple start/callback (shared OIDC helper) | **+0.5 day** | Reuse Google route pattern; `client_secret_post` |
| First-login `name` capture | **+2–4 h** | Parse `user` POST body on callback when present |
| Login UI: Apple button | **+1 h** | Same pattern as Google — navigate to `/api/auth/oidc/apple/start` |
| Tests (mock token + JWT secret) | **+0.5 day** | invalid_client, relay email, missing name on re-login |
| Private Email Relay domain registration | **0 at launch** | No server mail |
| S2S notification endpoint | **0 at launch** | Unless Korea-based operator |
| **Incremental over Google-only** | **~1–1.5 dev-days** | Console + secret + first-login name |

Google remains the longer pole for **verification calendar** (OAuth consent screen production review). Apple has no equivalent web verification queue, but misconfigured Services ID / expired JWT causes immediate `invalid_client`.

---

## Decisions to feed sibling tickets

- **#158:** Accept `@privaterelay.appleid.com` as verified email; persist Apple `sub` in `user_identities`; capture `name` on first callback only; account linking by email must handle relay ≠ real iCloud email.
- **#163:** Console checklist above; env vars; confirm operator region for S2S requirement.
- **#161:** Apple button alongside Google; no Apple JS popup required if using server redirect.

---

## Sources

| Source | URL |
| --- | --- |
| Configure Sign in with Apple for the web (Account Help) | https://developer.apple.com/help/account/configure-app-capabilities/configure-sign-in-with-apple-for-the-web/ |
| About Sign in with Apple (primary App ID / grouping) | https://developer.apple.com/help/account/capabilities/about-sign-in-with-apple/ |
| Configuring your environment for Sign in with Apple | https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple |
| Configuring your webpage for Sign in with Apple | https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple |
| Authenticating users with Sign in with Apple | https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple |
| Creating a client secret | https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret |
| Enabling server-to-server notifications | https://developer.apple.com/help/account/capabilities/enabling-server-to-server-notifications/ |
| Processing account changes (S2S events) | https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts |
| Korea S2S requirement (2026-01-01) | https://developer.apple.com/news/?id=j9zukcr6 |
| Apple OIDC discovery | https://appleid.apple.com/.well-known/openid-configuration |
| Web-only App ID vs App Store (forum) | https://developer.apple.com/forums/thread/836711 |
| HourDen SSO baseline | `docs/research/sso-auth.md` |
