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
    basicauth {
        # bcrypt hash — generate with: caddy hash-password
        operator <bcrypt-hash>
    }

    root * /var/www/hourden
    try_files {path} /index.html
    file_server

    handle_path /api/* {
        reverse_proxy localhost:3001
    }
}
```

Reload Caddy after updating the config.

### Verify production

```bash
HOURDEN_BASIC_AUTH_USER=operator HOURDEN_BASIC_AUTH_PASSWORD='…' ./scripts/verify-production.sh
```

- `https://hourden.hannesduve.com` prompts for basic auth, then shows the HourDen shell
- The page reports `API status: ok`
- `GET /api/health` returns the seeded `workspaceId`

## Workspace seam

`getCurrentWorkspaceId()` in `apps/api` is the single choke-point for workspace resolution ([ADR-0004](./docs/adr/0004-multi-tenant-prep-boundary.md)). MVP returns the seeded workspace id from `@hourden/domain`, exposed on the health endpoint as `workspaceId`.

## Relationship to the invoice script

Until the PDF port (slice 6), HourDen will export a Clockify-compatible CSV that the existing `generate_invoice.py` (kept outside this repo) consumes unchanged.
