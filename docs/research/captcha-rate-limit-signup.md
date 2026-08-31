# CAPTCHA and rate limits for public signup (2026)

Research for [What CAPTCHA and rate-limit options fit a self-hosted Hetzner deploy?](https://github.com/HaDuve/HourDen/issues/159) — abuse controls for Phase 2 public signup on a single Hetzner VM (Caddy → Hono API, no Cloudflare proxy).

Feeds [What abuse controls guard public signup at launch?](https://github.com/HaDuve/HourDen/issues/157).

## Deploy context

| Piece | Today |
| --- | --- |
| Edge | Portfolio Caddy in Docker on `188.245.242.141`; `/api/*` → `host.docker.internal:3001` |
| API | Hono 4 on Node 20, single process, no Redis |
| Signup (planned) | `POST /api/auth/register` per [#156](https://github.com/HaDuve/HourDen/issues/156) |
| SSO (planned) | BFF OAuth on Hono per `docs/research/sso-auth.md` |
| Trust gap | No email verification in v1; need CAPTCHA + rate limits |

Caddy is the **stock** Portfolio image — not built with `mholt/caddy-ratelimit`. Adding edge rate limits means a custom Caddy binary or image rebuild across Portfolio services. Treat edge RL as **out of scope for v1** unless Portfolio ops wants that change.

## Comparison matrix

| | **Cloudflare Turnstile** | **hCaptcha Basic** | **ALTCHA (OSS, self-hosted)** |
| --- | --- | --- | --- |
| **Cost (v1 scale)** | Free Standard plan — unlimited challenges, up to 20 widgets/account, 10 hostnames/widget ([Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)) | Free Basic — unlimited evaluations ([pricing](https://www.hcaptcha.com/pricing)) | Free (MIT). Sentinel / Cloud are paid add-ons |
| **Privacy / data** | Minimal signals; no ad tracking. Still a **US processor** (Cloudflare Inc.); Turnstile Privacy Addendum + DPA; EU-US DPF ([privacy addendum](https://www.cloudflare.com/turnstile-privacy-policy/)) | Privacy-oriented vs reCAPTCHA; still **US processor** (Intuition Machines); DPA + SCCs + DPF ([GDPR page](https://www.hcaptcha.com/gdpr)). Free tier can participate in publisher program | **No third-party transfer** in OSS PoW mode — challenge + verify on your server ([server integration](https://altcha.org/docs/integration/server/)) |
| **EU / GDPR posture** | Lawful with DPA + transfer mechanism; not “zero processor” | Same pattern — operator is controller, documents transfer | Strongest **by architecture** — no personal data leaves VM |
| **UX** | Managed / invisible modes; WCAG 2.2 AAA on free tier | Free tier: standard challenges; **passive (no puzzle) mode is Pro** ($99–139/mo) | PoW in browser — no image puzzles; slight CPU delay on submit |
| **Bot resistance** | Strong (Cloudflare bot signals) | Strong on paid tiers; Basic adequate for low-volume launch | OSS PoW alone is **weaker** against dedicated bots; Sentinel adds ML but is another service to run |
| **Operator setup** | Dashboard: site key + secret; 2 env vars on VM. **No Cloudflare zone/proxy required** — Turnstile works standalone | Dashboard: site key + secret; 2 env vars | Generate HMAC secret; mount `GET /api/altcha/challenge` + verify in register handler; `altcha-lib` has [Hono plugin](https://github.com/altcha-org/altcha-lib/blob/main/docs/hono.md) |
| **Hono integration** | ~15 lines: `fetch` POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` ([server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)) | Same shape: POST `https://api.hcaptcha.com/siteverify` ([hCaptcha docs](https://docs.hcaptcha.com/#verify-the-user-response-server-side)) | `npm install altcha-lib`; challenge route + middleware on `/register` |
| **Frontend** | `@marsidev/react-turnstile` or script tag; token in JSON body | `react-hcaptcha` or script tag; `h-captcha-response` | `@altcha/widget` web component; `altcha` field |
| **CSP** | `challenges.cloudflare.com` script/frame/connect | `*.hcaptcha.com` (use wildcard, not hard-coded subdomains) | Same-origin only (self-hosted) |
| **Failure modes** | Token 5 min TTL, single-use; generic 400 on verify fail | Same pattern | Replay blocked via in-memory `CappedMap` store (single instance OK) |

### Ruled out for v1

| Option | Why skip |
| --- | --- |
| **Google reCAPTCHA** | Privacy/GDPR friction; 10k free assessments/mo then paid; worse UX than Turnstile |
| **Caddy `rate_limit` plugin** | Requires custom Caddy build; Portfolio VM uses stock image — high blast radius |
| **Redis-backed distributed RL** | Single API instance today; in-memory sufficient until horizontal scale |
| **ALTCHA Sentinel (self-hosted)** | Extra container + ops for a soft launch; revisit if Turnstile abuse persists |

## Rate limiting (Hono, app layer)

Use **`hono-rate-limiter`** ([npm](https://www.npmjs.com/package/hono-rate-limiter), [docs](https://honohub.dev/docs/rate-limiter)) — widely used, Hono 4 compatible, in-memory store default (fits single Node on VM).

Apply **narrow middleware** on abuse-sensitive routes only — not global `/api/*` (would throttle authenticated CRUD).

### Client IP behind Caddy

Caddy forwards `X-Forwarded-For`. Hono key generator should prefer the leftmost untrusted hop or use `@hono/node-server` / manual read of `x-forwarded-for` with a fixed trust of the Caddy hop. Integration tests can skip RL via `skip: () => process.env.NODE_ENV === 'test'`.

### Suggested v1 limits (starting points for #157)

| Route | Key | Limit | Rationale |
| --- | --- | --- | --- |
| `POST /api/auth/register` | IP | 5 / hour | Slow mass account creation |
| `POST /api/auth/register` | email (body) | 3 / day | Credential-stuffing / harassment |
| `POST /api/auth/login` | IP | 20 / 15 min | Brute force without locking legit users |
| `GET /api/auth/oidc/*/start` | IP | 10 / 15 min | OAuth redirect spam |

Email-keyed limits need a **route-specific handler** (parse body once, check counter in memory or a small `rate_limit_buckets` table). IP limits fit standard middleware.

Return **429** with `{ error: "Too many requests" }` — same shape as other API errors. Do not leak whether email exists on register (409 duplicate vs 429: prefer counting attempts before user lookup where possible).

CAPTCHA runs **inside** the register handler **after** coarse IP limit, **before** `createUserWithWorkspace`. Failed CAPTCHA → **400** `{ error: "Verification failed" }` (no user row created).

## Recommended v1 defaults

### CAPTCHA: **Cloudflare Turnstile (Managed widget)**

**Why Turnstile over hCaptcha for HourDen v1:**

1. **Invisible by default on free tier** — hCaptcha passive mode is Pro-only.
2. **Same operator cost ($0)** but lower signup friction for a DE/EU freelancer product.
3. **Simplest Hono path** — one outbound `fetch` to Siteverify; no challenge-generation route to maintain.
4. **GDPR posture is acceptable** for a soft launch with DPA documented in privacy policy — same transfer class as Google/Apple SSO already on the roadmap ([#158](https://github.com/HaDuve/HourDen/issues/158)).

**Why not ALTCHA OSS as default:**

- Proof-of-work alone is a softer target for scripted signup at a public URL.
- Sentinel is the realistic hardening path but adds a second service on an already busy VM.
- Keep ALTCHA documented as the **privacy-max upgrade** if the operator later wants zero US CAPTCHA processor (accept weaker bot resistance or budget for Sentinel).

### Rate limits: **`hono-rate-limiter` in API**

- Signup + login + OIDC start only.
- In-memory store; no Redis until multi-instance.
- Skip Caddy plugin for v1.

### Where CAPTCHA applies

| Endpoint | CAPTCHA v1? |
| --- | --- |
| `POST /api/auth/register` | **Yes** |
| `POST /api/auth/login` | No (rate limit only) |
| OIDC start / callback | No (rate limit on start; IdP handles bot cost) |

Login CAPTCHA can be added later if credential stuffing appears.

## Implementation sketch (not a build ticket)

### Env (VM + `.env.example`)

```
TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

Dev: Cloudflare dashboard allows `localhost` hostnames on the widget.

### API

```ts
// Before createUserWithWorkspace in POST /register
const token = body.turnstileToken;
if (!token || !(await verifyTurnstile(token, clientIp))) {
  return c.json({ error: "Verification failed" }, 400);
}
```

### Web

Turnstile widget on signup form only; pass `turnstileToken` in register JSON. Reset widget on 400.

### Operator checklist

1. Create Turnstile widget at [dash.cloudflare.com](https://dash.cloudflare.com/) → Turnstile (no zone required).
2. Hostnames: `hourden.com`, `localhost`.
3. Add secrets to `/opt/HourDen/.env`; redeploy API.
4. Mention Cloudflare Turnstile in privacy policy (processor + purpose: bot prevention).

## Privacy-max alternative

If **zero US CAPTCHA processor** is a hard requirement before launch:

- Use **ALTCHA OSS** with `altcha-lib` Hono plugin.
- Set PoW `cost` conservatively (e.g. PBKDF2 cost 5_000 per [Hono example](https://github.com/altcha-org/altcha-lib/blob/main/docs/hono.md)).
- Plan Sentinel only if abuse metrics justify another container.

## Sources

- [Cloudflare Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/)
- [hCaptcha pricing](https://www.hcaptcha.com/pricing)
- [hCaptcha GDPR](https://www.hcaptcha.com/gdpr)
- [hCaptcha server verify](https://docs.hcaptcha.com/#verify-the-user-response-server-side)
- [ALTCHA server integration](https://altcha.org/docs/integration/server/)
- [altcha-lib Hono plugin](https://github.com/altcha-org/altcha-lib/blob/main/docs/hono.md)
- [hono-rate-limiter](https://www.npmjs.com/package/hono-rate-limiter)
- [mholt/caddy-ratelimit](https://github.com/mholt/caddy-ratelimit) (deferred for Portfolio VM)
