# HourDen

Your den for billable hours — log work, close the month, send the invoice.

HourDen is a self-hosted, web-only time tracker that replaces Clockify for a solo freelance operator and unifies the path from tracked time to invoices. MVP is single-user; the domain model is prepared for multi-user workspaces without a rewrite.

## Status

Early build. Design decisions are captured, implementation is sliced into agent-grabbable issues.

- Domain glossary: [`CONTEXT.md`](./CONTEXT.md)
- Architecture decisions: [`docs/adr/`](./docs/adr/)

## Stack

- **Web**: Vite + React + TypeScript + Tailwind + shadcn/ui (static build)
- **API**: Hono + TypeScript
- **DB**: PostgreSQL
- **Deploy**: Docker on the shared Hetzner VM, served at `hourden.hannesduve.com` behind Portfolio's Caddy

See [ADR-0001](./docs/adr/0001-web-stack-self-hosted.md) and [ADR-0003](./docs/adr/0003-share-portfolio-caddy.md).

## Layout (target)

```
apps/
  api/        Hono + Postgres
  web/        Vite + React
packages/
  domain/     shared types, validation, entry-grouping logic
docker-compose.yml
docs/adr/
```

## Relationship to the invoice script

Until the PDF port ([ADR-0001](./docs/adr/0001-web-stack-self-hosted.md), slice 6), HourDen exports a Clockify-compatible CSV that the existing `generate_invoice.py` (kept outside this repo) consumes unchanged.
