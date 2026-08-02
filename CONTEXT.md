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

**Language** — the **User**'s preferred UI language (Phase 1: English or German), following that person across their devices. A per-**User** preference, distinct from the **Workspace**'s **Calendar Timezone** and from the **Invoice Sender** identity. Governs on-screen labels and how dates and amounts are displayed to the Operator; it does not change **Sent** **Invoice** PDFs or the Clockify CSV export, which keep their existing format.
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

**Tracker** — the primary time-tracking view (Clockify time tracker analogue): lists the most recent Time Entries for the Workspace, paginated (50, 100, or 200), ordered newest-first and grouped by calendar month then day using the Workspace **Calendar Timezone**. Month headers read "This month", "Last month", or a month and year (e.g. "May 2026"); day headers show the local date and daily total. The Operator starts/stops the **Running Timer** and adds **Manual Entries** from this screen. Routes: `/`, `/tracker`; legacy `/today` redirects to `/tracker`; nav label is "Tracker".
_Avoid_: Today (retired screen name), time tracker (unqualified — use **Tracker**)

**Billable Complete** — a stopped Time Entry with a non-empty Description. Incomplete entries stay editable and appear in Tracker/Report but are excluded from invoicing.
_Avoid_: complete entry, valid entry

**Invoiced Entry** — a Time Entry linked to an **Invoice** (`invoice_id` set). While the invoice is **issued** (not yet **Sent**), membership can change: entries may be unlinked or re-linked as the Operator edits coverage. Once the invoice is **Sent** (or **Voided**), covered entries are read-only so work is not double-billed; voiding frees them for a replacement **Issue**. The **Issuance Snapshot** at **Sent** freezes line content regardless of later entry edits.
_Avoid_: Locked entry, frozen entry

**Clockify Import** — bulk load of historical Time Entries from Clockify CSV exports. Rows dedupe by an import fingerprint so re-uploading the same file does not duplicate entries. Rates and amounts are stored per row as recorded in the CSV.
_Avoid_: migration, sync

## Billing

**Invoice Prefix** — short label prepended to a prefixed **Invoice Number** (e.g. `BAN` in `BAN2026003`). Stored on the **Client**; default is derived from the **Client** `name` (not **Recipient** legal name): take the first three letters A–Z, skipping spaces, punctuation, and digits, uppercased; if fewer than three letters exist, use what's available (e.g. `AB` → `AB`). The Operator can edit a different prefix on preview (letters and digits, 1–6 characters, uppercased on save); it is persisted to the **Client** when an invoice is issued. The prefixed sequence counter is per **Client** per calendar year — every issued invoice for that **Client** in the year advances the count, whether prefixed or plain. Changing the prefix mid-year continues the count (e.g. after `BAN2026002`, renaming to `BD` suggests `BD2026003`).

**Invoice Sender** — the business identity of the **Workspace** on invoices: legal name, address, tax number, email, phone, bank details. Stored on the **Workspace** (not on the **User** login record). Copied into the **Issuance Snapshot** at **Issue** (and rewritten on invoice edits until **Sent**) so later Workspace-setting edits do not silently change a frozen PDF. Replaces env-based `HOURDEN_OPERATOR_*` for invoice and report export. Each **User** with an owned **Workspace** can edit these fields from the Invoices page; changes apply to future previews, new issues, and explicit edits on an `issued` invoice — **Sent** invoices stay frozen in their snapshot. New Workspaces created via `create-user` start with empty sender fields; the first invoice preview prompts the **User** to fill them in if not configured yet (`sender_name` null = unconfigured).
_Avoid_: Operator (when you mean this PDF header block — **Operator** is the person acting; **Invoice Sender** is the printed business identity)

**Recipient** — the billing identity of a **Client**: legal name + postal address printed on the invoice PDF, plus **Recipient email** for **Prepare Email** (not printed on the PDF). Not a separate entity — these are fields on the Client (nullable until the Client is first invoiced / first prepare-email). One Client has exactly one Recipient identity.
_Avoid_: modeling Recipient as its own table (collapsed into Client — see ADR-0002)

**Email Greeting Name** — short name on the **Client** for mail copy only (e.g. “Anna” in “Hallo Anna,”), distinct from **Recipient** legal name on the PDF. Nullable; used as a placeholder in the **Invoice Email Template** at **Prepare Email** time. Not printed on the invoice PDF.
_Avoid_: Recipient name (when you mean the legal PDF name), salutation (unqualified)

**Invoice Email Template** — optional subject + body on the **Client** used by **Prepare Email**. Placeholders (filled at prepare time): `{{greetingName}}` (**Email Greeting Name**, else **Recipient** legal name), `{{billingMonth}}` (month + year of the **Billing Period** end, e.g. “Juli 2026”), `{{invoiceNumber}}`, `{{period}}` (formatted date-range **Billing Period**), `{{operatorName}}` (**Invoice Sender** name). If the Client has none, the **Workspace** default template is used; if that is also empty, the UI-language default template is used (locale month-based copy). Edited anytime on Client/Workspace; read live at prepare time (not snapshotted onto the invoice).
_Avoid_: email draft (persisted outbound messages do not exist)

**Invoice** — a PDF request for payment covering a **Billing Period** for one Recipient, built from grouped **Billable Complete** Time Entries (by date + description). Statuses: **`issued`** (persisted, editable) → **`sent`** (immutable) → **`voided`** (superseded). At most one non-voided Invoice per **Client** per billing month (calendar month of the Billing Period `to` date); a **Voided** prior allows a replacement **Issue** for that month. Each **Invoice Number** is unique across the whole **Workspace** among non-freed numbers (German compliance: no duplicate numbers on separate invoices; **Voided** numbers stay reserved). Default format is **Invoice Prefix** + calendar year + per-**Client** sequence (e.g. `BAN2026003` — Bandao's 3rd invoice in 2026), with a minimum three-digit suffix that grows beyond 999 when needed (`BAN20261000`). The Operator may turn off "Use prefix" on preview (or while `issued`) for a single invoice to get a plain **Workspace**-global number instead (`2026001`, `2026002`, …); only plain-format invoices advance that counter. The **Client**'s saved prefix is unchanged. HourDen warns if a number already exists anywhere in the Workspace. When the number is changed (on preview or while `issued`), the Operator chooses whether future invoices continue the original suggested sequence (count-based) or from the edited number (suffix-based); the old number becomes free again. That override policy is per **Client** per calendar year for prefixed numbers, and **Workspace**-wide per calendar year for plain numbers. While **`issued`**, the Operator may change Invoice Number, prefix/use-prefix, Recipient (including email), Invoice Sender block on this invoice, Billing Period, and line membership — each successful edit rewrites the working **Issuance Snapshot**. **Sent** freezes that snapshot; live Client/entry/Workspace edits never rewrite it. Correction after delivery: **Void** the **Sent** invoice and **Issue** a new one for the same period (new number), then **Prepare Email** again. HourDen owns only the invoices it issues; invoices predating the switch from the legacy script live in the parent repo's `Outgoing/` archive.
_Avoid_: Bill, draft invoice (persisted pre-issue drafts do not exist — **Preview** is the dry-run)

**Voided Invoice** — `status` used when a **Sent** invoice is superseded: the **Invoice Number** is never reused, the row is excluded from list/reconstruct/**Outgoing export**, and its **Invoiced Entries** become free for a replacement **Issue**. Design rule for post-delivery correction (void + reissue); void UI ships with that flow.
_Avoid_: cancelled invoice, credit note, Unsent (aborting prepare-email returns the row to `issued` — not a void)

**Issuance Snapshot** — JSON of Recipient block, **Invoice Sender** block, grouped lines, totals. Written at **Issue**, **rewritten on every successful edit** while status is `issued`, and **frozen at Sent** (ADR-0006, ADR-0014). Reconstruction renders the PDF from this snapshot plus the current **Invoice Number**, not from live Client/entry/Workspace data. PDF bytes are not stored.
_Avoid_: stored PDF, template snapshot

**Preview** — dry-run invoice for a Client + Billing Period: grouped lines, suggested **Invoice Number**, PDF bytes without persisting. Lets the Operator edit the number, prefix toggle, and numbering strategy before **Issue**.
_Avoid_: draft invoice (persisted drafts do not exist), Reader (Reader is for persisted invoices)

**Reader** — in-app view of a persisted invoice’s current reconstructed PDF (`issued` or `sent`), using the same sheet/iframe chrome as **Preview**. While `issued`, reflects the working snapshot after edits; while `sent`, the frozen artifact.
_Avoid_: Preview (pre-issue dry-run only)

**Issue** — persist an **Invoice** row with status `issued`, save the working **Issuance Snapshot**, assign the **Invoice Number**, link covered Time Entries, and return downloadable PDF bytes. Does not freeze the invoice — **Sent** does.
_Avoid_: send (server-side email delivery is out of scope; see **Prepare Email** / **Sent**)

**Prepare Email** — open the Operator’s default mail client with **Recipient email**, subject/body from the **Invoice Email Template** (Client, else Workspace default, with **Email Greeting Name** and other placeholders filled), and trigger a PDF download so the Operator attaches it manually (`mailto:` cannot attach files). The Email tab also offers **Copy draft** and an **Open mail app** `mailto:` link (user-gesture fallback). After prepare, ask **Did your mail app open?** — **No** keeps `issued` and shows how to fix the OS default email reader (browsers must not own `mailto:`); **Yes** then asks **Did you send it?** Confirms that marking **Sent** will lock the invoice.
_Avoid_: send email (HourDen does not transmit mail), SMTP

**Sent** — status (and act of confirming delivery intent) that freezes an **Invoice**: **Issuance Snapshot** and number no longer change; covered **Invoiced Entries** lock. Reached when **Prepare Email** runs, the Operator confirms the mail app opened, and answers **Yes** to “Did you send it?”; **No** (or mail did not open) leaves/returns status `issued` (editable again). Not undone after a confirmed send — post-delivery fixes use **Voided** + replacement **Issue**. Existing rows created under the old “immutable at Issue” rule migrate to `sent`.
_Avoid_: Unsent (not a status), delivered (no proof from the mail app)

**Billing Period** — the date range of work included on an Invoice (typically one calendar month). On the Invoices tab, month quick controls (`< last this >`) above the date pickers set this/last calendar month or step one month from the current filter.

**Dashboard** — a **Workspace** overview screen (Clockify dashboard analogue) summarizing tracked time and billable value over a selected date range: headline totals (total time, total billable amount, top **Project**, top **Client**), a per-day time distribution, a by-**Client** distribution, and a ranked list of most-tracked activities (by **Description**). Read-only — no entry editing happens here. Shares the same month quick controls (`< last this >`) as Report and Invoices. A primary navigation destination alongside Tracker and Invoices; the default landing screen remains **Tracker**.
_Avoid_: Analytics, Overview, Insights (in nav copy — the label is "Dashboard")

**Report** — a date-range view of Time Entries grouped by Client with duration and amount totals, used to review before invoicing. Can be exported as a Clockify-compatible CSV (full Clockify column set) that the existing `generate_invoice.py` consumes unchanged. Month quick controls (`< last this >`) above the date pickers set this/last calendar month or step one month from the current filter.
_Avoid_: Summary, timesheet

**Outgoing export** — download a zip of invoices laid out as `Outgoing/{RECIPIENT}/{year}/{number}_{dd_mm_yy}_Invoice_….pdf`, or (Chromium) auto-file a single PDF into an Operator-chosen local archive root on **Issue** as `{RECIPIENT}/{year}/…` under that root (same relative path; typically today’s `Outgoing/`). Zip remains a demoted escape hatch (“Download all outgoing invoices”). Issue never blocks on folder access; missing root or permission → Issue succeeds + prompt/retry; existing archive file → skip write + warn. Safari/Firefox hide local-archive controls. Forward-only (no backfill of already-issued invoices). Intended zip use after **Sent**; excludes voided and snapshot-less rows.
_Avoid_: server-side write into the Operator’s Mac filesystem; silent overwrite of existing archive PDFs

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
> **System**: Invoice BAN2026006 issued (editable). 47 entries linked. Open **Reader**, edit, or **Prepare Email** when ready.
>
> **Operator**: Prepare Email.
>
> **System**: Opens mail client (Recipient email + template). Downloads PDF to attach. Copy draft / Open mail app as fallback. “Did your mail app open?” → Yes → “Did you send it?” → Yes marks **Sent** (frozen); No (or mail didn’t open) keeps it issued.
