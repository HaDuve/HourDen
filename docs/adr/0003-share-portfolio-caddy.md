# Serve HourDen through Portfolio's Caddy on VM1

HourDen deploys to the same Hetzner VM as Portfolio and is served at `hourden.hannesduve.com` by **Portfolio's existing Caddy** (which already owns ports 80/443 and terminates TLS), not its own. Portfolio's `Caddyfile` gains a vhost that serves HourDen's static build from a shared volume and reverse-proxies `/api` to HourDen's `api` container. HourDen's compose ships only `api` + `postgres` (+ a frontend build step into the shared web volume). VM check confirmed ~2.9 GiB free RAM with only Caddy + analytics running, so Postgres + Hono fit comfortably; n8n may be removed if needed and only the Portfolio website is untouchable.

**Considered options:** HourDen runs its own Caddy (rejected — two containers cannot both bind 443; would need a front proxy); separate VM (rejected — cost, per ADR-0001).

**Consequences:** HourDen's deploy is coupled to Portfolio's Caddy config — a cross-repo dependency to document in both runbooks. For the future multi-tenant **C** phase the plan is a separate domain and likely a dedicated host, decoupling from Portfolio then.
