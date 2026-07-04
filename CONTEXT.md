# HourDen

Personal time-tracking and invoice generation for a solo freelance operator. Replaces Clockify for daily logging and unifies the path from tracked time to PDF invoices. MVP is single-user; the domain model is shaped so multi-user workspaces can be added later without a rewrite. The name: **Hour** (billable time) + **Den** (the Operator's private Workspace) — "your den for billable hours."

## Actors

**Operator** — the person who logs time, runs reports, and issues invoices. MVP has exactly one Operator per **Workspace**.
_Avoid_: User (when you mean the human operator in product copy — reserve **User** for the future auth entity)

**Workspace** — the top-level container for all time data, clients, projects, rates, and invoice history; the "Den" the product is named for. MVP ships with one hardcoded workspace; every persisted row carries `workspace_id` for future multi-tenancy.
_Avoid_: Account, organization (in MVP copy)

## Time tracking

**Client** — a billable organization or person you work for and invoice. Carries a default hourly **Billable Rate** and an **Invoice Prefix** (saved on first issue). Maps to Clockify's "Client" column and to invoice **Recipients** where they overlap (e.g. BANDAO, HANNAH). Delete is blocked while Projects still reference the Client (ADR-0005).
_Avoid_: Customer (Portfolio glossary uses this for prospects), SME Client, Recipient (invoice-side name — see Billing)

**Billable Rate** — default hourly rate in EUR on a **Client**; used to compute a Time Entry's amount (duration × rate).
_Avoid_: hourly rate (unqualified — always tie to Client)

**Project** — work stream under a Client (e.g. Ondojo under Bandao, Coaching under Hannah).
_Avoid_: Job, engagement

**Time Entry** — one logged interval: start, end (or duration), linked Project, free-text **Description**, optional **Tags**, billable flag, computed amount from the Client's **Billable Rate**. A stopped entry needs a non-empty Description to be **Billable Complete**; invoicing groups only Billable Complete entries by date + description.
_Avoid_: Timesheet row, log line

**Tag** — optional free-form label on a Time Entry for reporting (e.g. Development, Communication). Ignored by invoices. Clockify's **Task** field is deliberately not modeled — it is unused in practice.
_Avoid_: Category, Task

**Running Timer** — a Time Entry with a start but no end, still accumulating. At most one exists per Workspace; starting a new one stops the current. Runs indefinitely if left open (no auto-stop in MVP).
_Avoid_: Active session, stopwatch

**Manual Entry** — a Time Entry created with both start and end set at once (backfilled work), never having been a Running Timer.
_Avoid_: Backfill, past entry

**Billable Complete** — a stopped Time Entry with a non-empty Description. Incomplete entries stay editable and appear in Today/Report but are excluded from invoicing.
_Avoid_: complete entry, valid entry

**Invoiced Entry** — a Time Entry linked to an issued **Invoice** (`invoice_id` set). Read-only: it cannot be edited or deleted so covered work is not double-billed. The **Issuance Snapshot** freezes line content regardless of later entry edits.
_Avoid_: Locked entry, frozen entry

**Clockify Import** — bulk load of historical Time Entries from Clockify CSV exports. Rows dedupe by an import fingerprint so re-uploading the same file does not duplicate entries. Rates and amounts are stored per row as recorded in the CSV.
_Avoid_: migration, sync

## Billing

**Invoice Prefix** — short label prepended to a prefixed **Invoice Number** (e.g. `BAN` in `BAN2026003`). Stored on the **Client**; default is derived from the **Client** `name` (not **Recipient** legal name): take the first three letters A–Z, skipping spaces, punctuation, and digits, uppercased; if fewer than three letters exist, use what's available (e.g. `AB` → `AB`). The Operator can edit a different prefix on preview (letters and digits, 1–6 characters, uppercased on save); it is persisted to the **Client** when an invoice is issued. The prefixed sequence counter is per **Client** per calendar year — every issued invoice for that **Client** in the year advances the count, whether prefixed or plain. Changing the prefix mid-year continues the count (e.g. after `BAN2026002`, renaming to `BD` suggests `BD2026003`).

**Recipient** — the billing identity of a **Client**: legal name + postal address printed on the invoice PDF. Not a separate entity — these are fields on the Client (nullable until the Client is first invoiced). One Client has exactly one Recipient identity.
_Avoid_: modeling Recipient as its own table (collapsed into Client — see ADR-0002)

**Invoice** — a PDF request for payment covering a **Billing Period** for one Recipient, built from grouped **Billable Complete** Time Entries (by date + description). At most one issued Invoice per **Client** per billing month (calendar month of the Billing Period `to` date). Each **Invoice Number** is assigned once across the whole **Workspace** (German compliance: no duplicate numbers on separate invoices). Default format is **Invoice Prefix** + calendar year + per-**Client** sequence (e.g. `BAN2026003` — Bandao's 3rd invoice in 2026), with a minimum three-digit suffix that grows beyond 999 when needed (`BAN20261000`). The Operator may turn off "Use prefix" on preview for a single issue to get a plain **Workspace**-global number instead (`2026001`, `2026002`, …); only plain-format invoices advance that counter. The **Client**'s saved prefix is unchanged. HourDen warns if a number already exists anywhere in the Workspace. When the number is changed, the Operator chooses whether future invoices continue the original suggested sequence (count-based) or from the edited number (suffix-based). That override policy is per **Client** per calendar year for prefixed numbers, and **Workspace**-wide per calendar year for plain numbers. Once **issued**, an invoice is immutable: it can be reconstructed exactly as sent from its **Issuance Snapshot** and is never rewritten by later edits to a Client or Time Entry. HourDen owns only the invoices it issues; invoices predating the switch from the legacy script live in the parent repo's `Outgoing/` archive.
_Avoid_: Bill

**Voided Invoice** — reserved `status` where the **Invoice Number** is never reused and the row is excluded from list/reconstruct/**Outgoing export**. Schema and numbering rules support voided rows; no void UI/API is shipped yet — design rule only for now.
_Avoid_: cancelled invoice, credit note

**Issuance Snapshot** — JSON captured at issue time: Recipient block, Operator identity, grouped lines, totals. Reconstruction renders the PDF from this snapshot, not from live Client/entry/env data (ADR-0006). PDF bytes are not stored.
_Avoid_: stored PDF, template snapshot

**Preview** — dry-run invoice for a Client + Billing Period: grouped lines, suggested **Invoice Number**, PDF bytes without persisting. Lets the Operator edit the number, prefix toggle, and numbering strategy before issue.
_Avoid_: draft invoice (persisted drafts do not exist)

**Issue** — persist an **Invoice** row, save the **Issuance Snapshot**, assign the **Invoice Number**, link covered Time Entries as **Invoiced**, and return downloadable PDF bytes.
_Avoid_: send (email delivery is out of scope)

**Billing Period** — the date range of work included on an Invoice (typically one calendar month). On the Invoices tab, month quick controls (`< last this >`) above the date pickers set this/last calendar month or step one month from the current filter.

**Report** — a date-range view of Time Entries grouped by Client with duration and amount totals, used to review before invoicing. Can be exported as a Clockify-compatible CSV (full Clockify column set) that the existing `generate_invoice.py` consumes unchanged. Month quick controls (`< last this >`) above the date pickers set this/last calendar month or step one month from the current filter.
_Avoid_: Summary, timesheet

**Outgoing export** — download a zip of issued invoices laid out as `Outgoing/{RECIPIENT}/{year}/{number}_{dd_mm_yy}_Invoice_….pdf`. Does not write to the parent Invoices repo filesystem; the Operator archives the zip or individual PDFs manually. Excludes voided and snapshot-less rows.
_Avoid_: auto-sync to Outgoing folder

## Flagged ambiguities

- **Client vs Recipient**: Clockify and day-to-day tracking say "Client"; `empfänger.csv` and PDF output say "Recipient". Canonical tracking term is **Client**; **Recipient** is that same Client's invoicing/legal identity (fields on the Client row), not a distinct entity.

## Example dialogue

> **Operator**: I logged 90 minutes on Ondojo yesterday — that's under the Bandao Client at 60 €/h.
>
> **System**: Time Entry saved: Project Ondojo → Client Bandao, billable, 90 min → 90 €.
>
> **Operator**: Generate June's invoice for Bandao.
>
> **System**: Billing Period 01.06–30.06.2026. Client Bandao maps to Recipient BANDAO Guidance GmbH. Grouping 47 Billable Complete entries by date + description → Preview Invoice BAN2026006.
>
> **Operator**: Issue it.
>
> **System**: Invoice BAN2026006 issued. 47 entries marked Invoiced. Download PDF or **Outgoing export** when ready.
