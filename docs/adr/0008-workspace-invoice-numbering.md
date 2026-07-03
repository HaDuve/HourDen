# ADR-0008: Workspace-wide invoice numbering with prefixed default

## Status

Accepted (supersedes parts of ADR-0007)

## Context

German tax practice requires each **Invoice Number** to be assigned once within the **Operator**'s invoicing system. HourDen previously scoped uniqueness and auto-numbering per **Client** (`(client_id, invoice_number)` unique index; `YYYY###` sequences independent per Client). That allowed `2026001` for Bandao and `2026001` for Hannah simultaneously — non-compliant for separate invoices.

The **Operator** also wants human-readable, client-scoped numbers by default (`BAN2026003`) while retaining an optional plain global sequence (`2026001`) for legacy alignment. Manual overrides with `sequential` / `from_last` policies (ADR-0007) remain, but their scope must match the two numbering pools.

## Decision

**Uniqueness**

- Enforce uniqueness on `(workspace_id, invoice_number)` for all issued invoices, including voided rows (numbers are never reused).
- Migration pre-checks for cross-Client duplicates and fails loudly if any exist; no auto-renumbering of issued invoices.
- Rely on the unique index for concurrent issue protection; a collision returns `duplicate_number`.

**Default format: prefixed**

- Pattern: `{InvoicePrefix}{YYYY}{suffix}` — e.g. `BAN2026003`.
- **Invoice Prefix** stored on **Client** (`invoice_prefix`, nullable until first issue); saved when an invoice is issued.
- Default prefix derived from **Client** `name`: first three letters A–Z (skip spaces, punctuation, digits), uppercased; shorter names use what's available.
- Operator may edit prefix (letters and digits, 1–6 chars, uppercased on save).
- Counter is per **Client** per calendar year; counts every invoice for that Client in the year (prefixed and plain). Mid-year prefix changes continue the count (after `BAN2026002`, rename to `BD` → `BD2026003`).
- Suffix: minimum three digits; grows naturally beyond 999 (`BAN20261000`).

**Optional format: plain**

- Per-issue "Use prefix" toggle on preview (default on). When off: `YYYY{suffix}` using a **Workspace**-global plain pool.
- Only plain-format numbers advance the plain counter; prefixed invoices do not consume plain slots.

**Override strategies (`sequential` | `from_last`)**

- Prefixed overrides: per **Client** per calendar year (`client_invoice_numbering` unchanged in purpose).
- Plain overrides: **Workspace**-wide per calendar year (new `workspace_invoice_numbering` table).
- Required when the issued number differs from the auto-suggestion (ADR-0007 behavior retained).

## Considered options

- **Global `YYYY###` only** — simpler, but loses client identity on the PDF; rejected in favour of prefixed default.
- **Per-prefix counter** — rejected; suffix reflects the Client's Nth invoice in the year, not the Nth use of a prefix string.
- **Grandfather existing cross-Client duplicates** — rejected; compliance requires a clean workspace-wide sequence from HourDen issuance onward.
- **Workspace row lock on issue** — rejected; unique-index collision with retry/error is sufficient for a solo Operator.

## Consequences

- ADR-0007's per-Client uniqueness and per-Client-only auto-numbering are replaced; editable-number UX and strategy enum remain.
- Integration tests that expect the same `YYYY###` for different Clients must change.
- Legacy `Outgoing/` PDFs with duplicate numbers across folders are out of scope; HourDen sequences only from DB-issued invoices.
- Domain layer needs distinct plain vs prefixed number builders/validators and separate existing-number queries per pool.
