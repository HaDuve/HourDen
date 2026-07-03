# HourDen

Personal time-tracking and invoice generation for a solo freelance operator. Replaces Clockify for daily logging and unifies the path from tracked time to PDF invoices. MVP is single-user; the domain model is shaped so multi-user workspaces can be added later without a rewrite. The name: **Hour** (billable time) + **Den** (the Operator's private Workspace) — "your den for billable hours."

## Actors

**Operator** — the person who logs time, runs reports, and issues invoices. MVP has exactly one Operator per **Workspace**.
_Avoid_: User (when you mean the human operator in product copy — reserve **User** for the future auth entity)

**Workspace** — the top-level container for all time data, clients, projects, rates, and invoice history; the "Den" the product is named for. MVP ships with one hardcoded workspace; every persisted row carries `workspace_id` for future multi-tenancy.
_Avoid_: Account, organization (in MVP copy)

## Time tracking

**Client** — a billable organization or person you work for and invoice. Carries a default hourly **Billable Rate**. Maps to Clockify's "Client" column and to invoice **Recipients** where they overlap (e.g. BANDAO, HANNAH).
_Avoid_: Customer (Portfolio glossary uses this for prospects), SME Client, Recipient (invoice-side name — see Billing)

**Project** — work stream under a Client (e.g. Ondojo under Bandao, Coaching under Hannah).
_Avoid_: Job, engagement

**Time Entry** — one logged interval: start, end (or duration), linked Project, free-text **Description**, optional **Tags**, billable flag, computed amount from the Client's rate at entry time. The **Description** is required because invoices group entries by date + description.
_Avoid_: Timesheet row, log line

**Tag** — optional free-form label on a Time Entry for reporting (e.g. Development, Communication). Ignored by invoices. Clockify's **Task** field is deliberately not modeled — it is unused in practice.
_Avoid_: Category, Task

**Running Timer** — a Time Entry with a start but no end, still accumulating. At most one exists per Workspace; starting a new one stops the current. Runs indefinitely if left open (no auto-stop in MVP).
_Avoid_: Active session, stopwatch

**Manual Entry** — a Time Entry created with both start and end set at once (backfilled work), never having been a Running Timer.
_Avoid_: Backfill, past entry

**Invoiced Entry** — a Time Entry whose **Billing Period** already has an Invoice. Read-only: it cannot be edited or deleted so a sent PDF's history stays intact.
_Avoid_: Locked entry, frozen entry

## Billing

**Recipient** — the billing identity of a **Client**: legal name + postal address printed on the invoice PDF. Not a separate entity — these are fields on the Client (nullable until the Client is first invoiced). One Client has exactly one Recipient identity.
_Avoid_: modeling Recipient as its own table (collapsed into Client — see ADR-0002)

**Invoice** — a PDF request for payment covering a **Billing Period** for one Recipient, built from grouped Time Entries (by date + description). Sequential **Invoice Number** per Recipient per calendar year. Once **issued** it is immutable: it can be reconstructed exactly as sent and is never rewritten by later edits to a Client or Time Entry. HourDen owns only the invoices it issues; invoices predating the switch from the legacy script live in the `Outgoing/` archive.
_Avoid_: Bill

**Billing Period** — the date range of work included on an Invoice (typically one calendar month).

**Report** — a date-range view of Time Entries grouped by Client with duration and amount totals, used to review before invoicing. Can be exported as a Clockify-compatible CSV (full Clockify column set) that the existing `generate_invoice.py` consumes unchanged.
_Avoid_: Summary, timesheet

## Flagged ambiguities

- **Client vs Recipient**: Clockify and day-to-day tracking say "Client"; `empfänger.csv` and PDF output say "Recipient". Canonical tracking term is **Client**; **Recipient** is that same Client's invoicing/legal identity (fields on the Client row), not a distinct entity.

## Example dialogue

> **Operator**: I logged 90 minutes on Ondojo yesterday — that's under the Bandao Client at 60 €/h.
>
> **System**: Time Entry saved: Project Ondojo → Client Bandao, billable, 90 min → 90 €.
>
> **Operator**: Generate June's invoice for Bandao.
>
> **System**: Billing Period 01.06–30.06.2026. Client Bandao maps to Recipient BANDAO Guidance GmbH. Grouping 47 entries by date + description → Invoice 2026006, PDF to Outgoing/BANDAO/2026/.
