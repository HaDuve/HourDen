# Issued vs sent invoice flows (prototype)

**Question:** What should issued vs sent invoice flows look like? (list actions, Reader, Edit, Prepare Email + Did you send?, Void+replace, Client email fields)

**Plan:** Three variants on `/prototype/sent-gate?variant=A|B|C`, switchable via floating bar. In-memory stubs only — no API. Not mounted on `/invoices`.

| Key | Name | Structure |
|-----|------|-----------|
| A | Row actions + sheets | Flat table + status; Reader/Edit/Prepare/Void as overlays (closest to today’s list) |
| B | Two-lane inbox | Ready-to-send vs Already-sent columns; Prepare as primary CTA; Did-you-send = sticky strip |
| C | Detail panel + tabs | Master–detail; PDF / Edit / Email tabs; status gates writability; Void on Email tab when sent; **year + month separators** on the master list |

**Verdict:** **C** — detail panel + tabs; master list grouped by year then month (billing-period end). Signed off 2026-08-02.
