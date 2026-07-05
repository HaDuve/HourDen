import { Pool } from "pg";
import { runMigrationsForTests } from "./migrate-for-tests.js";

let prepared: Promise<void> | undefined;

/** Clear the per-process setup guard — for tests only. */
export function resetPrepareIntegrationDatabaseForTests(): void {
  prepared = undefined;
}

/** Migrate and seed the test operator when DATABASE_URL is configured. */
export async function prepareIntegrationDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  if (!prepared) {
    prepared = (async () => {
      const pool = new Pool({ connectionString: databaseUrl });
      try {
        await runMigrationsForTests(pool);
      } finally {
        await pool.end();
      }
    })();
  }

  await prepared;
}
