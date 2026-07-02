# Block Client delete when Projects exist

A **Client** can have many **Projects** (work streams for time tracking). Deleting a Client must not orphan Projects or silently remove billable structure the Operator still uses.

**Decision:** Client delete is **blocked** when any Project references that Client. The API returns **409** with a clear error; the database enforces `projects.client_id` → `clients(id) ON DELETE RESTRICT`.

**Considered options:** cascade delete Projects with the Client (rejected — destroys time-tracking structure without an explicit per-Project delete); soft-delete Client (deferred — not needed for MVP single-operator).

**Consequences:** The Operator must delete or reassign Projects before removing a Client. When Time Entries reference Projects (slice 3+), Client delete policy may need revisiting; this ADR covers the Client↔Project edge only.
