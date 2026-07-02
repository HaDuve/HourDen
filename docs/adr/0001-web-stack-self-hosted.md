# Web-only stack on existing Hetzner VM

MVP is a web-only time tracker for a solo Operator, with multi-user workspaces prepared but not implemented. We chose **Vite + React** (static frontend), **Hono** (API), and **PostgreSQL**, all self-hosted via Docker on the same Hetzner VM as Portfolio (~€0 incremental hosting). Caddy serves the static build and reverse-proxies `/api`. Invoice PDF generation stays in the existing Python `generate_invoice.py` until the tracker UI is stable; the API exports Clockify-compatible CSV in the interim.

**Considered options:** Expo + RN Web (rejected — mobile/native deferred, RN Web adds overhead for table-heavy reports); Next.js full-stack (rejected — Node runtime for UI we do not need; Portfolio uses static export, this app is different); new VM or managed DB (rejected — cost). MVP auth is env-based (Caddy basic auth or API key), not a SaaS provider.

**Consequences:** AFK slices split cleanly into `apps/api`, `apps/web`, `packages/domain`. Future mobile is a new client against the same API, not a repo rewrite. RAM on VM1 must be monitored when Postgres is added alongside Portfolio services.
