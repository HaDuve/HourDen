# Recipient identity as fields on Client, not a separate entity

Invoices need a legal name + postal address (the **Recipient**). Real data is strictly 1 Client ↔ 1 Recipient (Bandao→BANDAO, Hannah→HANNAH) with no reuse across Clients, so we store `legal_name`, `address_line1`, `address_line2` as nullable fields directly on the **Client** row rather than a separate `recipients` table with an FK. This eliminates the fuzzy string matcher in `generate_invoice.py` (`match_client_to_recipient`), which silently skipped unmatched clients.

**Considered options:** separate Recipient table with `client.recipient_id` (rejected — premature; only pays off if one legal entity is billed under multiple tracking Clients, which has never occurred); keep `empfänger.csv` external match (rejected — the brittleness we are removing).

**Consequences:** Nullable fields let a Client be tracked before billing details exist. If a real shared-Recipient case appears later, extract a table via migration — easy while single-user.
