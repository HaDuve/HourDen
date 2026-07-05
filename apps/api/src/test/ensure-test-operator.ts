import type { Pool } from "pg";
import { seedAuthMigration } from "../db/migrations/012-auth.js";

/** Ensure the test operator user exists with credentials from test setup env vars. */
export async function ensureTestOperator(pool: Pool): Promise<void> {
  await seedAuthMigration(pool);
}
