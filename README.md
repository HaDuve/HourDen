# HourDen

Your den for billable hours — log work, close the month, send the invoice.

HourDen is a self-hosted, web-only time tracker that replaces Clockify for a solo freelance operator and unifies the path from tracked time to invoices. MVP is single-user; the domain model is prepared for multi-user workspaces without a rewrite.

## Status

**MVP complete** — live at [`hourden.hannesduve.com`](https://hourden.hannesduve.com) (session login). Slices 0–6 shipped: time tracking, clients/projects, report + CSV export, Clockify import, and native invoice PDF generation with preview, issuance, reconstruction, and Outgoing.zip export. Auth slice 1 (#35): operator login via `/login` ([ADR-0009](./docs/adr/0009-session-auth-and-workspace-isolation.md)).

**Tabs:** Tracker · Clients · Projects · Report · Invoices · Import

Native PDFs are the primary invoicing path. `generate_invoice.py` (parent Invoices repo) stays available for manual cross-check over the next days before we retire it.

- Domain glossary: [`CONTEXT.md`](./CONTEXT.md)
- Architecture decisions: [`docs/adr/`](./docs/adr/)

## Stack

- **Web**: Vite + React + TypeScript + Tailwind (static build)
- **API**: Hono + TypeScript + PostgreSQL
- **Deploy**: Docker on the shared Hetzner VM, served at `hourden.hannesduve.com` behind Portfolio's Caddy

See [ADR-0001](./docs/adr/0001-web-stack-self-hosted.md) and [ADR-0003](./docs/adr/0003-share-portfolio-caddy.md).

## Layout

```
apps/
  api/        Hono + Postgres
  web/        Vite + React
packages/
  domain/     shared types and constants
docker-compose.yml
docs/adr/
```

## Local development

### Prerequisites

- Node.js 20+
- npm 10+
- Docker (for Postgres + API container)

### Setup

```bash
npm install
cp .env.example .env
# Set HOURDEN_OPERATOR_PASSWORD before first API start (migration creates the operator User)
```

### Run API + Postgres (Docker)

```bash
docker compose up --build
```

The API listens on `http://localhost:3001`. Migrations run on container start and seed a single Workspace row.

Postgres is published on host port **5433** (not 5432) to avoid clashing with a local Postgres install. The API container still talks to Postgres on the internal Docker network.

### Data persistence (important!)

Your Postgres data lives in a Docker volume (`hourden_postgres_data`) that **survives container rebuilds**. To avoid accidentally losing data:

**✅ Safe commands (data persists):**
```bash
docker compose up --build      # rebuild API, keep Postgres data
docker compose stop            # stop containers, keep data
docker compose start           # restart stopped containers
docker compose restart         # quick restart
```

**⚠️ Dangerous commands (can lose data):**
```bash
docker compose down -v         # DELETES the volume and all data
docker volume prune            # deletes unused volumes (if containers are stopped)
```

**Daily workflow:**
- After making code changes: `docker compose up --build` (rebuilds API, keeps data)
- When done working: Just leave it running, or `docker compose stop`
- Coming back: `docker compose start` or `docker compose up`

Only use `docker compose down` (without `-v`) when you need to remove containers completely. NEVER use `down -v` unless you explicitly want to delete all tracked time and clients.

### Run web (Vite dev server)

**Start the API first** (Docker or `npm run dev:api`), then:

In a second terminal:

```bash
npm run dev:web
```

Open `http://localhost:5173`. Sign in at `/login` with `HOURDEN_OPERATOR_EMAIL` / `HOURDEN_OPERATOR_PASSWORD` from `.env`.

### Run API without Docker (optional)

With Postgres from Docker Compose (host port 5433):

```bash
cp .env.example .env   # DATABASE_URL uses localhost:5433
npm run migrate -w @hourden/api
npm run dev:api
```

### Tests and typecheck

```bash
npm test
npm run typecheck
npm run build
npm run verify:build   # production import smoke (after build)
```

Migration integration tests run when `DATABASE_URL` is set (CI provides Postgres automatically).

## Auth (Phase 1)

Production browser access uses **app login** at `/login` ([ADR-0009](./docs/adr/0009-session-auth-and-workspace-isolation.md)). Portfolio's Caddy terminates TLS and reverse-proxies `/api`; it does **not** use edge basic auth.

- **Operator account**: created on migrate from `HOURDEN_OPERATOR_EMAIL` and `HOURDEN_OPERATOR_PASSWORD` (required on the VM before first deploy after auth slice 1). Migration also seeds the Default Workspace **Invoice Sender** and **Calendar Timezone** from `HOURDEN_OPERATOR_*` / `HOURDEN_TIMEZONE` (request handling reads the Workspace row, not env).
- **QA / additional testers**: provision with `npm run create-user -- --email … --password … --workspace …` (see below).
- **Session**: httpOnly cookie; 30-day sliding expiry; logout clears the server-side row.
- **`HOURDEN_API_KEY`** (optional): when set, middleware accepts a valid session **or** API key — useful for scripts hitting `:3001` directly.
- **`GET /api/health`**: public; returns `{ ok: true }` only (no workspace metadata).

### Create a QA user (CLI)

```bash
npm run create-user -- \
  --email qa@example.com \
  --password 'SecurePass1' \
  --workspace 'QA Workspace'
```

Optional: `--sender-name`, `--sender-email`, `--calendar-timezone` (IANA). Password must meet policy (8+ chars, upper, lower, digit). The new **User** can sign in at `/login` and lands in an empty **Workspace** with empty **Invoice Sender** fields — the first invoice preview prompts setup on the Invoices page (**Invoice sender** button).

Each **Workspace** owner can edit **Invoice Sender** on the Invoices page or via `GET`/`PATCH /api/workspace/invoice-sender`.

## Deploy to `hourden.hannesduve.com`

HourDen shares VM1 with Portfolio. Portfolio's Caddy serves the static web bundle and reverse-proxies `/api` to the HourDen API container ([ADR-0003](./docs/adr/0003-share-portfolio-caddy.md)).

### Automated deploy (recommended)

Same pattern as Portfolio `deploy-remote.sh`:

```bash
cp scripts/deploy-remote.example.sh scripts/deploy-remote.sh
chmod +x scripts/deploy-remote.sh
# set SSH_TARGET in deploy-remote.sh (gitignored)
./scripts/deploy-remote.sh
```

Deploy **after** changes are on `main`. Set operator env on the VM (`/opt/HourDen/.env`) before the first auth deploy — see `.env.example`.

Optional verify after deploy (uses operator credentials from local `.env`):

```bash
VERIFY_PRODUCTION=1 ./scripts/deploy-remote.sh
```

### Manual deploy

```bash
./scripts/deploy.sh
# on VM: git pull, docker compose up -d --build, publish web dist to /var/www/hourden
```

### Portfolio Caddy vhost (one-time)

Add to Portfolio's `Caddyfile` (no edge basic auth — the app login page is the browser gate):

```caddyfile
hourden.hannesduve.com {
    encode gzip zstd

    handle /api/* {
        reverse_proxy host.docker.internal:3001
    }

    handle {
        root * /var/www/hourden
        try_files {path} /index.html
        file_server
    }
}
```

Reload Caddy after updating the config.

Portfolio's Caddy runs **inside Docker**. HourDen's API is published on the **host** at `:3001`, and static files live at `/var/www/hourden` on the host. The Portfolio `docker-compose.yml` must include:

- `extra_hosts: ["host.docker.internal:host-gateway"]` on the `caddy` service
- volume mount `/var/www/hourden:/var/www/hourden:ro` on the `caddy` service

The vhost must use `reverse_proxy host.docker.internal:3001` (not `localhost:3001`).

If production shows 404/502 after first deploy, run on the VM:

```bash
# from HourDen repo on your machine
ssh root@188.245.242.141 'bash -s' < scripts/fix-caddy-vm.sh
```

### Verify production

```bash
./scripts/verify-production.sh
```

Requires `HOURDEN_OPERATOR_EMAIL` and `HOURDEN_OPERATOR_PASSWORD` in `.env` (or the environment).

- `https://hourden.hannesduve.com/` serves the SPA (no Caddy basic-auth prompt)
- `GET /api/health` returns `{ "ok": true }` without auth
- `POST /api/auth/login` succeeds for the operator account and sets a session cookie
- `GET /api/auth/me` and `GET /api/clients` succeed with that session cookie

## Workspace seam

`getCurrentWorkspaceId()` in `apps/api` resolves the active **Workspace** from the logged-in **Session** ([ADR-0004](./docs/adr/0004-multi-tenant-prep-boundary.md), [ADR-0009](./docs/adr/0009-session-auth-and-workspace-isolation.md)). Unauthenticated API requests (except public routes) return 401.

## Relationship to invoice generation

HourDen generates invoice PDFs natively via the **Invoices** tab or `POST /api/invoices`. The legacy `generate_invoice.py` script (parent Invoices repo) remains available for manual comparison during the transition — we are not retiring it yet.

### Generate an invoice (API)

```bash
curl -f -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{"clientId":"<uuid>","from":"2026-06-01","to":"2026-06-30"}' \
  --output invoice.pdf
```

The Client must have Recipient fields (`legalName`, `addressLine1`, `addressLine2`) set. Covered Time Entries in the Billing Period are marked **Invoiced** (read-only). One invoice per Client per billing month (calendar month of `to`). On the **Invoices** tab, the Billing Period date pickers share the same month quick controls as Report (`< last this >`).

### Local smoke test

With Postgres + API running:

```bash
./scripts/test-invoice-local.sh
```

Compares the generated PDF layout against golden text snapshots. Use `UPDATE_SNAPSHOT=1` only when intentionally changing PDF layout.

### Report + CSV export

- **Report** tab: pick a date range, review Time Entries grouped by Client (lines merged by date + description). Quick controls above the date pickers set **this month** or **last month**, or step one calendar month backward/forward from the current filter (`< last this >`).
- **Export CSV**: downloads the full Clockify column set for the selected range — still consumable by `generate_invoice.py` when you want the Python path.

### Manual PDF comparison (transition)

While we validate native PDFs in production, compare HourDen output against `generate_invoice.py` for real billing months:

1. Issue via the **Invoices** tab (or `./scripts/test-invoice-local.sh` locally).
2. Open the PDF beside a reference from `Outgoing/<RECIPIENT>/<year>/` generated by `generate_invoice.py`.
3. Confirm layout, totals, §19 UStG text, and payment details match.

Merge-time HITL sign-off is recorded on PR #18. See `docs/hitl/invoice-pdf-signoff.md`.

Operator name/email in Clockify CSV exports come from the active **Workspace** **Invoice Sender** (stored on `workspaces`, seeded at migration from env).
