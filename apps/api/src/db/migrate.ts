import type { Pool } from "pg";
import { seedAuthMigration } from "./migrations/012-auth.js";
import { MIGRATIONS } from "./migrations.js";

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const migration of MIGRATIONS) {
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE id = $1",
      [migration.id],
    );

    if (applied.rowCount && applied.rowCount > 0) {
      continue;
    }

    await pool.query("BEGIN");
    try {
      if (migration.preCheck) {
        await migration.preCheck(pool);
      }
      if (migration.sql) {
        await pool.query(migration.sql);
      }
      if (migration.apply) {
        await migration.apply(pool);
      }
      await pool.query(
        "INSERT INTO schema_migrations (id) VALUES ($1)",
        [migration.id],
      );
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  // Re-seed operator user on every test run so credentials match test setup even when
  // migration 012 was first applied with a developer's .env operator email.
  if (process.env.VITEST) {
    await seedAuthMigration(pool);
  }
}

export async function getWorkspaceCount(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM workspaces",
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function workspaceExists(
  pool: Pool,
  workspaceId: string,
): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM workspaces WHERE id = $1",
    [workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}
