import type { Pool } from "pg";

import type { SupportedLocale } from "@hourden/domain";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  locale: SupportedLocale | null;
};

export type SessionRow = {
  id: string;
  user_id: string;
  active_workspace_id: string;
  expires_at: Date;
};

export async function findUserByEmail(
  pool: Pool,
  email: string,
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    "SELECT id, email, password_hash, locale FROM users WHERE email = $1",
    [email.toLowerCase()],
  );
  return result.rows[0] ?? null;
}

export async function findSessionById(
  pool: Pool,
  sessionId: string,
): Promise<SessionRow | null> {
  const result = await pool.query<SessionRow>(
    `
      SELECT id, user_id, active_workspace_id, expires_at
      FROM sessions
      WHERE id = $1
    `,
    [sessionId],
  );
  return result.rows[0] ?? null;
}

export async function hasMembership(
  pool: Pool,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM workspace_memberships
      WHERE user_id = $1 AND workspace_id = $2
    `,
    [userId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function createSession(
  pool: Pool,
  input: {
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  },
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO sessions (user_id, active_workspace_id, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [input.userId, input.activeWorkspaceId, input.expiresAt],
  );
  return result.rows[0]!.id;
}

export async function touchSession(
  pool: Pool,
  sessionId: string,
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    "UPDATE sessions SET expires_at = $2 WHERE id = $1",
    [sessionId, expiresAt],
  );
}

export async function deleteSession(
  pool: Pool,
  sessionId: string,
): Promise<void> {
  await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function findOwnerWorkspaceIdForUser(
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const result = await pool.query<{ workspace_id: string }>(
    `
      SELECT workspace_id
      FROM workspace_memberships
      WHERE user_id = $1 AND role = 'owner'
      ORDER BY workspace_id
      LIMIT 1
    `,
    [userId],
  );
  return result.rows[0]?.workspace_id ?? null;
}
