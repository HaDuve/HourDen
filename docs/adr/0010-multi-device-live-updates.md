# Multi-device live updates via SSE with in-memory workspace fan-out

## Status

Accepted

## Context

A **User** may keep the same **Workspace** open on several devices at once (e.g. laptop + phone) and expects the **Live Counter** and Today's entries to stay in sync in near real time — start a timer on the phone, watch it tick and then stop on the laptop. Today the UI has no live behaviour at all: the Running Timer's elapsed time is computed server-side once per page load (`durationMinutes`) and never advances, and nothing tells other devices that state changed. The stack is a Vite/React SPA behind Caddy, a Hono API on Node, and Postgres, currently a single API container on one Hetzner VM (ADR-0001).

## Decision

- **Ticking is client-side.** The Live Counter advances via a 1-second interval that computes elapsed time from the Running Timer's `startedAt`. No server round-trips to make numbers move.
- **Cross-device changes push over SSE.** A single authenticated `GET` SSE endpoint (session cookie, same-origin) streams to the browser. Mutations stay ordinary REST `POST`/`PATCH` — the stream is server→client only. WebSocket was rejected (no client→server streaming need; extra Caddy config); pure polling was rejected (laggy, wasteful).
- **Messages are invalidation signals, not payloads.** Events name what changed (e.g. `timer-changed`, `today-changed`); the client refetches the existing endpoints it already uses. This reuses all current serialization and avoids drift/ordering bugs between a push path and the REST path.
- **Sync scope is the Running Timer + Today's entries.** Clients, Projects, Invoices, and settings change rarely and stay refetch-on-navigate.
- **Fan-out is an in-memory bus keyed by `workspace_id`** (a map of `workspace_id` → set of open connections). A mutation notifies the other connections for that workspace. Concurrent timer starts keep the existing domain rule (CONTEXT.md): last-start-wins stops the prior timer, and the stopped device shows a non-blocking notice.

## Consequences

- **Single-instance assumption.** The in-memory bus only fans out within one API process. Running multiple API replicas would silently break cross-instance delivery. If the API is ever scaled out, replace the bus with **Postgres `LISTEN`/`NOTIFY`** (or Redis pub/sub) — this is the named escape hatch, not a rewrite of the client contract.
- Caddy must not buffer the SSE response; the proxy passes `text/event-stream` through with flushing.
- Sessions can be revoked/expire mid-stream (ADR-0009); the endpoint drops unauthenticated connections and the client reconnects or bounces to `/login`.
- New surface: one SSE route, the workspace bus, and a client hook that maps events to refetches — no new tables.
