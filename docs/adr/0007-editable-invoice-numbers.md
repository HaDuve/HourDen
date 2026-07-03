# ADR-0007: Editable invoice numbers with numbering strategy

## Status

Accepted

## Context

HourDen assigns the next **Invoice Number** per Client per calendar year when previewing an invoice. Operators migrating from the legacy `generate_invoice.py` flow sometimes need a number that does not match the auto-suggested value (e.g. continuing an existing sequence from before HourDen).

Changing a number affects what the *next* invoice should be. Two reasonable policies exist:

1. **Sequential** — count how many invoices were issued this year and add one to the suffix, ignoring the numeric gap introduced by a manual override (issue `2026010` as the first invoice → next suggested `2026002`).
2. **From last** — treat the issued number as the high-water mark (issue `2026010` → next suggested `2026011`).

## Decision

- Preview and issue endpoints accept an optional `invoiceNumber`.
- Preview returns `X-Suggested-Invoice-Number`, `X-Invoice-Number`, and `X-Invoice-Number-Exists` headers.
- `GET /api/invoices/numbering-preview` returns both future-number options when the Operator edits the number.
- Issue requires `numberingStrategy` (`sequential` | `from_last`) when `invoiceNumber` differs from the suggested value.
- The chosen strategy is persisted in `client_invoice_numbering (client_id, invoice_year)` and used for subsequent auto-numbering that year.

## Consequences

- Operators can align HourDen with pre-existing numbering without leaving the preview/issue flow.
- Duplicate numbers are blocked at issue time and surfaced as a warning during preview.
- Numbering strategy is per Client per year; a new calendar year starts fresh with sequential defaults.
