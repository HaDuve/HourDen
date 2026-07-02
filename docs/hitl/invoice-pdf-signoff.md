# HITL: Invoice PDF sign-off (issue #8)

Before merging native invoice PDF generation, a human Operator must confirm billing correctness.

## Steps

1. Start API + Postgres locally (`docker compose up` or `npm run dev:api`).
2. Run `./scripts/test-invoice-local.sh` **or** invoice a real Client/month:

   ```bash
   curl -f -X POST http://localhost:3001/api/invoices \
     -H "Content-Type: application/json" \
     -d '{"clientId":"<uuid>","from":"2026-06-01","to":"2026-06-30"}' \
     --output native-invoice.pdf
   ```

3. Open `native-invoice.pdf` beside a known-good PDF from `generate_invoice.py` (e.g. `Outgoing/BANDAO/2026/` in the parent Invoices repo).
4. Verify:
   - Recipient address block
   - Grouped line items (date + description totals)
   - Invoice number format (`YYYYnnn`)
   - §19 UStG legal text
   - Payment details (IBAN, BIC, due date)
   - Overall layout matches (section order, two-column header)

## PR sign-off

Comment on the PR when complete, e.g.:

> HITL sign-off: compared `invoice-test.pdf` to `2026006_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf` — layout and totals match.
