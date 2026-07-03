# HourDen

Your den for billable hours — log work, close the month, send the invoice.

HourDen is a self-hosted, web-only time tracker that replaces Clockify for a solo freelance operator and unifies the path from tracked time to invoices. MVP is single-user; the domain model is prepared for multi-user workspaces without a rewrite.

## Status

Slice 0 skeleton: monorepo, API health endpoint, web shell, Postgres migrations, CI.

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

Open `http://localhost:5173`. The page calls `/api/health` (proxied to the API) and shows the status.

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

## Auth (MVP)

Production uses **Caddy basic auth** on `hourden.hannesduve.com` (Portfolio's Caddy terminates TLS and protects the vhost). When `HOURDEN_API_KEY` is set, the API requires that key on **all** routes (including `/health`) — useful when the API port is exposed without Caddy.

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

Deploy **after** changes are on `main`. Optional verify: `VERIFY_PRODUCTION=1 HOURDEN_BASIC_AUTH_USER=… HOURDEN_BASIC_AUTH_PASSWORD=… ./scripts/deploy-remote.sh`

### Manual deploy

```bash
./scripts/deploy.sh
# on VM: git pull, docker compose up -d --build, publish web dist to /var/www/hourden
```

### Portfolio Caddy vhost (one-time)

Add to Portfolio's `Caddyfile` (adjust paths and credentials):

```caddyfile
hourden.hannesduve.com {
    basic_auth {
        # bcrypt hash — generate with: caddy hash-password
        operator <bcrypt-hash>
    }

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
HOURDEN_BASIC_AUTH_USER=operator HOURDEN_BASIC_AUTH_PASSWORD='…' ./scripts/verify-production.sh
```

- `https://hourden.hannesduve.com` prompts for basic auth, then shows the HourDen shell
- The page reports `API status: ok`
- `GET /api/health` returns the seeded `workspaceId`

## Workspace seam

`getCurrentWorkspaceId()` in `apps/api` is the single choke-point for workspace resolution ([ADR-0004](./docs/adr/0004-multi-tenant-prep-boundary.md)). MVP returns the seeded workspace id from `@hourden/domain`, exposed on the health endpoint as `workspaceId`.

## Relationship to invoice generation

HourDen generates invoice PDFs natively via `POST /api/invoices`. The legacy `generate_invoice.py` script (parent Invoices repo) remains available for comparison during the transition.

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

### Report + CSV export (legacy path)

- **Report** tab: pick a date range, review Time Entries grouped by Client (lines merged by date + description). Quick controls above the date pickers set **this month** or **last month**, or step one calendar month backward/forward from the current filter (`< last this >`).
- **Export CSV**: downloads the full Clockify column set for the selected range — still consumable by `generate_invoice.py` if needed.

### HITL: compare against Python PDF

Before retiring `generate_invoice.py`, compare a native PDF against a known-good invoice:

1. Run `./scripts/test-invoice-local.sh` (or invoice a real Client/month via the API).
2. Open the output PDF alongside a reference from `Outgoing/<RECIPIENT>/<year>/` generated by `generate_invoice.py`.
3. Confirm layout, totals, §19 UStG text, and payment details match.
4. Record sign-off on the PR (issue #8 acceptance criteria).

See also `docs/hitl/invoice-pdf-signoff.md`.

Operator name/email in exports (`User`, `Email` columns) come from `HOURDEN_OPERATOR_NAME` and `HOURDEN_OPERATOR_EMAIL` (see `.env.example`).
