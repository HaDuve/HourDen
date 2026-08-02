# Invoices are reconstructed from an issuance snapshot, not stored; HourDen owns invoices forward-only

Migrating from `generate_invoice.py` (which writes PDFs to `Outgoing/{RECIPIENT}/{year}/`) to native HourDen invoicing. The operator does **not** need HourDen to persist PDF bytes — the requirement is to **reconstruct** an invoice and **export** the correct `Outgoing/` structure (a single PDF, or the whole tree zipped). A reconstructed **Sent** invoice must equal what was actually mailed, but its inputs (Recipient fields on the **Client**, Operator identity, grouped **Time Entries**) are mutable, so rebuilding from live data would silently drift. **Issue** alone is not the freeze — see ADR-0014.

**Decision:**

- Do **not** store PDF bytes. Reconstruct on demand from stored metadata plus an **issuance snapshot**.
- On **Issue**, persist a working snapshot (recipient block, invoice sender, grouped lines, totals) as `jsonb` on the `invoices` row; **rewrite it on edits** while status is `issued`; **freeze at Sent**. Reconstruction renders from the snapshot (plus invoice number), not from live Clients/entries/Workspace settings.
- **Forward-only ownership:** HourDen reconstructs/exports only invoices it issued. Pre-switch history stays in the parent `Invoices/` repo's `Outgoing/` archive (the legal record of what was sent).
- The folder layout (`Outgoing/{RECIPIENT}/{year}/{number}_{dd_mm_yy}_Invoice_….pdf`) is a server-side convention (`Invoice Sender` name with spaces → `_`, Client name casing preserved; quotes/path separators sanitized); export yields a single PDF or the whole tree zipped.

**Considered options:**

- **Store PDF bytes** (`bytea` column, server volume, or S3) — rejected: no need for stored artifacts; bloats the DB or adds a second stateful volume; sent PDFs are already archived by the Python path for history.
- **Backfill legacy invoice records** so 2025–mid-2026 reconstruct from HourDen — rejected: no issued invoice records exist, imported entries all use a single *current* Client rate (`clockify-import.ts`) so totals risk mismatching the sent PDFs, and those PDFs are the legal record already archived.
- **Reconstruct from live data (no snapshot)** — rejected: later edits to a Client's recipient details, the operator env, or a Time Entry would silently rewrite past invoices.
- **Freeze snapshot at Issue** — superseded by ADR-0014: Operators need full edit after persist until **Prepare Email** / **Sent**.

**Consequences:**

- `invoices` gains a `snapshot jsonb` column — the one bit of persisted state, but of *inputs*, not the PDF.
- Editing a Client's Recipient details or Workspace Invoice Sender affects future previews/issues and can be applied explicitly on an `issued` invoice; **Sent** invoices stay faithful to their frozen snapshot.
- Locking **Invoiced Entries** read-only applies at **Sent** (and while voided coverage rules hold); while `issued`, membership may change (ADR-0014).
- The PDF template/layout (`invoice-pdf.ts`) is **not** snapshotted: a future layout change re-renders past invoices differently. Add a `template_version` if true byte-stability is ever required.
- New users have no legacy split — only the single existing operator has history, which lives in the Python `Outgoing/` archive.
