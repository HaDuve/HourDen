# HITL: Invoice PDF sign-off (issue #8)

## Merge sign-off (complete)

PR #18 — HITL sign-off recorded 2026-07-02:

> HITL sign-off: compared native invoice PDF to Python reference — layout and totals match (LGTM).

Native PDF generation merged and shipped. Issue #8 closed.

## Ongoing transition check (manual)

`generate_invoice.py` is **not retired yet**. Over the next days, compare real billing-month PDFs from HourDen against Python references before dropping the script.

1. Issue via the **Invoices** tab (or `./scripts/test-invoice-local.sh` / `POST /api/invoices` locally).
2. Open the HourDen PDF beside a known-good PDF from `generate_invoice.py` (e.g. `Outgoing/BANDAO/2026/` in the parent Invoices repo).
3. Verify:
   - Recipient address block
   - Grouped line items (date + description totals)
   - Invoice number format (prefixed or plain per ADR-0007/0008)
   - §19 UStG legal text
   - Payment details (IBAN, BIC, due date)
   - Overall layout matches (section order, two-column header)

When satisfied across real months, retire `generate_invoice.py` as a separate decision (no issue required for MVP closure).
