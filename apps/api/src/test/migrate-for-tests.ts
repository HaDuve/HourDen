import type { Pool } from "pg";
import { runMigrations } from "../db/migrate.js";
import { ensureTestOperator } from "./ensure-test-operator.js";

export async function runMigrationsForTests(pool: Pool): Promise<void> {
  await runMigrations(pool);
  await ensureTestOperator(pool);
}
