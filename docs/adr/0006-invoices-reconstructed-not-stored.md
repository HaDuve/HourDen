# Invoices are reconstructed from an issuance snapshot, not stored; HourDen owns invoices forward-only

Migrating from `generate_invoice.py` (which writes PDFs to `Outgoing/{RECIPIENT}/{year}/`) to native HourDen invoicing. The operator does **not** need HourDen to persist PDF bytes — the requirement is to **reconstruct** an invoice and **export** the correct `Outgoing/` structure (a single PDF, or the whole tree zipped). A reconstructed invoice must equal what was actually sent, but its inputs (Recipient fields on the **Client**, Operator identity from env, grouped **Time Entries**) are mutable, so rebuilding from live data would silently drift.

**Decision:**

- Do **not** store PDF bytes. Reconstruct on demand from stored metadata plus an **issuance snapshot**.
- On creation, persist a snapshot (recipient block, operator identity, grouped lines, totals) as `jsonb` on the `invoices` row; reconstruction renders from the snapshot, not from live Clients/entries/env.
- **Forward-only ownership:** HourDen reconstructs/exports only invoices it issued. Pre-switch history stays in the parent `Invoices/` repo's `Outgoing/` archive (the legal record of what was sent).
- The folder layout (`Outgoing/{RECIPIENT}/{year}/{number}_{dd_mm_yy}_Invoice_Hannes_Duve_{RECIPIENT}.pdf`) is a server-side convention; export yields a single PDF or the whole tree zipped.

**Considered options:**

- **Store PDF bytes** (`bytea` column, server volume, or S3) — rejected: no need for stored artifacts; bloats the DB or adds a second stateful volume; sent PDFs are already archived by the Python path for history.
- **Backfill legacy invoice records** so 2025–mid-2026 reconstruct from HourDen — rejected: no issued invoice records exist, imported entries all use a single *current* Client rate (`clockify-import.ts`) so totals risk mismatching the sent PDFs, and those PDFs are the legal record already archived.
- **Reconstruct from live data (no snapshot)** — rejected: later edits to a Client's recipient details, the operator env, or a Time Entry would silently rewrite past invoices.

**Consequences:**

- `invoices` gains a `snapshot jsonb` column — the one bit of persisted state, but of *inputs*, not the PDF.
- Editing a Client's Recipient details or the Operator env affects only *future* invoices; issued invoices stay faithful.
- Locking **Invoiced Entries** read-only (already implemented — see `db/time-entries.ts`) is now redundant for *fidelity* since the snapshot freezes lines, but still valuable: it prevents double-billing an entry and keeps the UX honest.
- The PDF template/layout (`invoice-pdf.ts`) is **not** snapshotted: a future layout change re-renders past invoices differently. Add a `template_version` if true byte-stability is ever required.
- New users have no legacy split — only the single existing operator has history, which lives in the Python `Outgoing/` archive.
