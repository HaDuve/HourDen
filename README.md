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

### Run web (Vite dev server)

In a second terminal:

```bash
npm run dev:web
```

Open `http://localhost:5173`. The page calls `/api/health` (proxied to the API) and shows the status.

### Run API without Docker (optional)

Start Postgres via Docker, then:

```bash
npm run migrate -w @hourden/api
npm run dev:api
```

### Tests and typecheck

```bash
npm test
npm run typecheck
npm run build
```

Migration integration tests run when `DATABASE_URL` is set (CI provides Postgres automatically).

## Auth (MVP)

Production uses **Caddy basic auth** on `hourden.hannesduve.com` (Portfolio's Caddy terminates TLS and protects the vhost). The API can additionally require `HOURDEN_API_KEY` on `/api/*` when set — useful for local dev without Caddy.

## Deploy to `hourden.hannesduve.com`

HourDen shares VM1 with Portfolio. Portfolio's Caddy serves the static web bundle and reverse-proxies `/api` to the HourDen API container ([ADR-0003](./docs/adr/0003-share-portfolio-caddy.md)).

### 1. Build artifacts

```bash
./scripts/deploy.sh
```

This builds `apps/web/dist` and `apps/api/dist`.

### 2. Publish web static files

Copy the web build to the shared volume/path Portfolio's Caddy serves, e.g. `/var/www/hourden`.

### 3. Start API + Postgres

On the VM, from this repo:

```bash
docker compose up -d --build
```

### 4. Portfolio Caddy vhost

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

### 5. Verify

- `https://hourden.hannesduve.com` prompts for basic auth, then shows the HourDen shell
- The page reports `API status: ok`

## Workspace seam

`getCurrentWorkspaceId()` in `apps/api` is the single choke-point for workspace resolution ([ADR-0004](./docs/adr/0004-multi-tenant-prep-boundary.md)). MVP returns the seeded workspace id from `@hourden/domain`.

## Relationship to the invoice script

Until the PDF port (slice 6), HourDen will export a Clockify-compatible CSV that the existing `generate_invoice.py` (kept outside this repo) consumes unchanged.
