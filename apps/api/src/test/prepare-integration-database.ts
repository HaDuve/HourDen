import { Pool } from "pg";
import { runMigrationsForTests } from "./migrate-for-tests.js";

/** Migrate and seed the test operator when DATABASE_URL is configured. */
export async function prepareIntegrationDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await runMigrationsForTests(pool);
  } finally {
    await pool.end();
  }
}
