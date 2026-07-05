# HourDen

Personal time-tracking and invoice generation for freelance operators. Replaces Clockify for daily logging and unifies the path from tracked time to PDF invoices. Auth ships in two phases: first **Users** with their own **Workspaces** (replace Caddy basic auth); later public self-service signup (SaaS). The name: **Hour** (billable time) + **Den** (the Operator's private Workspace) — "your den for billable hours."

## Actors

**User** — a person with login credentials (email + password). Email is the login identifier (unique). Password policy Phase 1: minimum 8 characters with at least one uppercase letter, one lowercase letter, and one digit. Owns or belongs to one or more **Workspaces** through **Membership**. Phase 1: separate **User** accounts for each tester (e.g. operator + QA); the operator account is created by migration from env (`HOURDEN_OPERATOR_EMAIL`, `HOURDEN_OPERATOR_PASSWORD`); additional accounts (e.g. QA) are created via a CLI (`create-user`), not self-service signup. Phase 2 (SaaS): strangers register and create a Workspace on signup. Login uses server-side **Sessions** (httpOnly cookie); SSO (OAuth/OIDC) can be added later as an alternate login path into the same session model.
_Avoid_: Operator (when you mean the auth/login entity — **Operator** is the in-workspace role)

**Session** — server-stored proof that a **User** is logged in. Random id in an httpOnly cookie; validated on each API request. Replaced on logout or expiry. Same mechanism for password login and future SSO. Replaces Caddy basic auth at the edge — the app login page is the only browser gate in production; unauthenticated visitors see `/login` only, not the app. Expires after 30 days of inactivity; each authenticated request extends the window (sliding).
_Avoid_: JWT (as the browser session carrier — IdP tokens may be used only during the SSO handshake)

**Operator** — the **User** acting inside a **Workspace**: logging time, running reports, issuing invoices. Phase 1: every User is sole Operator of their Workspace(s) — no shared workspaces yet. Phase 2 adds **Members** (multiple Users per Workspace with roles).
_Avoid_: User (in product copy when describing what someone does day-to-day inside the app)

**Workspace** — the top-level container for all time data, clients, projects, rates, and invoice history; the "Den" the product is named for. Data is isolated per Workspace. Every persisted row carries `workspace_id`. Carries **Invoice Sender** settings (name, address, tax, bank, contact — the Operator block printed on PDFs and used in Clockify CSV export) and a **Calendar Timezone** (IANA, e.g. `Europe/Berlin`) for Tracker, Reports, and Clockify export day boundaries. A **User** accesses a Workspace through a **Membership** (Phase 1: `owner` only). Phase 1: each test **User** gets at least one Workspace; a **User** may own several Workspaces — session holds `active_workspace_id`, defaulting to the sole workspace on login; no switcher UI until a User has two or more. Phase 2: Workspaces can have multiple **Members** with roles beyond owner. The existing seeded Default Workspace becomes the operator's production Workspace on auth migration — data and `workspace_id` values are preserved, not reset; sender and timezone fields are seeded from today's env/defaults.
_Avoid_: Account, organization (in product copy)

**Membership** — links a **User** to a **Workspace** with a **Role**. Phase 1 creates one `owner` membership per User on their Workspace(s). API rejects requests whose session `active_workspace_id` is not covered by a membership for the logged-in User.
_Avoid_: invite, team (Phase 2 concepts)

**Onboarding** — the first-run guided setup for a not-yet-configured **Workspace**: add a **Client**, add a **Project** under it, fill the **Invoice Sender** ("Invoice Data"), then land on Tracker. Every step is skippable and Tracker is always reachable; the flow is considered done once the Workspace has been set up or the Operator dismisses it, and does not reappear thereafter. Onboarding is a property of the **Workspace** being set up, not of the **User**.
_Avoid_: wizard, tour, setup wizard (in domain copy)

**Language** — the **User**'s preferred UI language (Phase 1: English or German), following that person across their devices. A per-**User** preference, distinct from the **Workspace**'s **Calendar Timezone** and from the **Invoice Sender** identity. Governs on-screen labels and how dates and amounts are displayed to the Operator; it does not change issued **Invoice** PDFs or the Clockify CSV export, which keep their existing format.
_Avoid_: Locale (as the user-facing term), i18n

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

**Live Counter** — the always-current elapsed time of the **Running Timer** as seen by the Operator: it advances second-by-second on the device viewing it, and reflects starts/stops made on any other device the same **User** has open on that **Workspace**. Because only one Running Timer exists per Workspace, starting a timer on one device stops it on the others (last-start-wins), and every open device converges on the same timer state.
_Avoid_: stopwatch (the visual widget), polling (the mechanism)

**Tracker** — the primary time-tracking view (Clockify time tracker analogue): lists the most recent Time Entries for the Workspace, paginated (50, 100, or 200), ordered newest-first and grouped by calendar week then day using the Workspace **Calendar Timezone**. Week headers read "This week", "Last week", or a date range; day headers show the local date and daily total. The Operator starts/stops the **Running Timer** and adds **Manual Entries** from this screen. Routes: `/`, `/tracker`; legacy `/today` redirects to `/tracker`; nav label is "Tracker".
_Avoid_: Today (retired screen name), time tracker (unqualified — use **Tracker**)

**Billable Complete** — a stopped Time Entry with a non-empty Description. Incomplete entries stay editable and appear in Tracker/Report but are excluded from invoicing.
_Avoid_: complete entry, valid entry

**Invoiced Entry** — a Time Entry linked to an issued **Invoice** (`invoice_id` set). Read-only: it cannot be edited or deleted so covered work is not double-billed. The **Issuance Snapshot** freezes line content regardless of later entry edits.
_Avoid_: Locked entry, frozen entry

**Clockify Import** — bulk load of historical Time Entries from Clockify CSV exports. Rows dedupe by an import fingerprint so re-uploading the same file does not duplicate entries. Rates and amounts are stored per row as recorded in the CSV.
_Avoid_: migration, sync

## Billing

**Invoice Prefix** — short label prepended to a prefixed **Invoice Number** (e.g. `BAN` in `BAN2026003`). Stored on the **Client**; default is derived from the **Client** `name` (not **Recipient** legal name): take the first three letters A–Z, skipping spaces, punctuation, and digits, uppercased; if fewer than three letters exist, use what's available (e.g. `AB` → `AB`). The Operator can edit a different prefix on preview (letters and digits, 1–6 characters, uppercased on save); it is persisted to the **Client** when an invoice is issued. The prefixed sequence counter is per **Client** per calendar year — every issued invoice for that **Client** in the year advances the count, whether prefixed or plain. Changing the prefix mid-year continues the count (e.g. after `BAN2026002`, renaming to `BD` suggests `BD2026003`).

**Invoice Sender** — the business identity of the **Workspace** on issued invoices: legal name, address, tax number, email, phone, bank details. Stored on the **Workspace** (not on the **User** login record). Copied into the **Issuance Snapshot** at issue time so later edits to Workspace settings do not change sent PDFs. Replaces env-based `HOURDEN_OPERATOR_*` for invoice and report export. Each **User** with an owned **Workspace** can edit these fields from the Invoices page; changes apply to future previews and issues only — already issued invoices stay frozen in their snapshot. New Workspaces created via `create-user` start with empty sender fields; the first invoice preview prompts the **User** to fill them in if not configured yet (`sender_name` null = unconfigured).
_Avoid_: Operator (when you mean this PDF header block — **Operator** is the person acting; **Invoice Sender** is the printed business identity)

**Recipient** — the billing identity of a **Client**: legal name + postal address printed on the invoice PDF. Not a separate entity — these are fields on the Client (nullable until the Client is first invoiced). One Client has exactly one Recipient identity.
_Avoid_: modeling Recipient as its own table (collapsed into Client — see ADR-0002)

**Invoice** — a PDF request for payment covering a **Billing Period** for one Recipient, built from grouped **Billable Complete** Time Entries (by date + description). At most one issued Invoice per **Client** per billing month (calendar month of the Billing Period `to` date). Each **Invoice Number** is assigned once across the whole **Workspace** (German compliance: no duplicate numbers on separate invoices). Default format is **Invoice Prefix** + calendar year + per-**Client** sequence (e.g. `BAN2026003` — Bandao's 3rd invoice in 2026), with a minimum three-digit suffix that grows beyond 999 when needed (`BAN20261000`). The Operator may turn off "Use prefix" on preview for a single issue to get a plain **Workspace**-global number instead (`2026001`, `2026002`, …); only plain-format invoices advance that counter. The **Client**'s saved prefix is unchanged. HourDen warns if a number already exists anywhere in the Workspace. When the number is changed, the Operator chooses whether future invoices continue the original suggested sequence (count-based) or from the edited number (suffix-based). That override policy is per **Client** per calendar year for prefixed numbers, and **Workspace**-wide per calendar year for plain numbers. Once **issued**, an invoice is immutable: it can be reconstructed exactly as sent from its **Issuance Snapshot** and is never rewritten by later edits to a Client or Time Entry. HourDen owns only the invoices it issues; invoices predating the switch from the legacy script live in the parent repo's `Outgoing/` archive.
_Avoid_: Bill

**Voided Invoice** — reserved `status` where the **Invoice Number** is never reused and the row is excluded from list/reconstruct/**Outgoing export**. Schema and numbering rules support voided rows; no void UI/API is shipped yet — design rule only for now.
_Avoid_: cancelled invoice, credit note

**Issuance Snapshot** — JSON captured at issue time: Recipient block, **Invoice Sender** block, grouped lines, totals. Reconstruction renders the PDF from this snapshot, not from live Client/entry/Workspace data (ADR-0006). PDF bytes are not stored.
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
