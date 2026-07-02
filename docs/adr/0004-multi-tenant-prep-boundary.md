# Multi-tenant prep limited to workspace_id + one resolution seam

MVP is single-user but must not require a schema rewrite to reach the multi-tenant **C** phase. We prepare for C in exactly two ways and no more: (1) every table carries `workspace_id uuid not null`, FK'd to a single seeded Workspace row; (2) the API resolves "current workspace" through one choke-point function (`getCurrentWorkspaceId()`) that returns a constant in MVP. Auth is a single env API key or Caddy basic auth (ADR-0001).

**Explicitly deferred (no stubs):** `users`/`memberships` tables, `created_by`/owner columns, roles, sessions/JWT, billing, onboarding. Empty stub tables are rejected because they are dead weight now and certain to drift from real auth requirements later.

**Consequences:** `workspace_id` (expensive to retrofit) is paid upfront; auth (cheap to add, certain to change) is deferred. When C starts, auth plugs into the single resolution seam and adds its own tables — not a migration of existing ones.
