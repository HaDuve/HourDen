# Immutability at Sent, not Issue

HourDen previously treated **Issue** as the freeze point: snapshot once, invoice immutable, entries locked. Operators still need to correct an invoice after persisting it but before the Recipient has been mailed — so freeze must move later.

**Decision:**

- Statuses: `issued` (persisted, editable) → `sent` (frozen) → `voided` (superseded; number reserved forever).
- **Issue** creates `issued`, writes a working **Issuance Snapshot**, assigns the number, links entries. Snapshot is **rewritten on every successful edit** while `issued`.
- **Prepare Email** opens the default mail client (`mailto:` with Recipient email + **Invoice Email Template**), downloads the PDF for manual attach, offers copy/open-mail fallbacks, asks “Did your mail app open?” then (if yes) “Did you send it?” — **Yes** → `sent` (freeze snapshot + lock entries); **No** / mail did not open → remain/return `issued`.
- No server-side SMTP. No OS auto-attach.
- Post-delivery correction: **Void** the `sent` row (number stays reserved; entries freed) and **Issue** a replacement for the same billing month (allowed because the prior is voided), then Prepare Email again. Do not unlock a confirmed `sent` invoice in place.
- Migrate existing `issued` rows (created under immutable-at-issue) to `sent` in one shot.

**Considered options:**

- **Number-only edit after Issue** — rejected: Operators need full correction before mail, not just the number.
- **Unlock after Sent (“Unsent”)** for faulty delivered invoices — rejected: if the Recipient already got it, void + reissue + mail again is the honest path; abort-only unlock is the “Did you send? No” answer.
- **Server-side email send** — rejected for now: Operator stays in their mail app; HourDen only prepares the draft.

**Consequences:**

- ADR-0006’s fidelity guarantee applies at **Sent**, not Issue; reconstruct still uses snapshot + number, never live Client/entry/Workspace data for frozen invoices.
- ADR-0008 uniqueness unchanged (including voided). While `issued`, changing the number frees the old value for reuse.
- List/API filters that assumed `issued` == immutable must distinguish `issued` vs `sent`.
- Client gains Recipient email + Email Greeting Name; Client/Workspace gain Invoice Email Template fields.
