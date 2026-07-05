import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate.js";
import { ensureTestOperator } from "./ensure-test-operator.js";
import { TEST_OPERATOR_EMAIL } from "./operator-credentials.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("ensureTestOperator", () => {
  const pool = new Pool({ connectionString: databaseUrl });

  afterAll(async () => {
    await pool.end();
  });

  it("creates the test operator user after migrations when missing", async () => {
    await runMigrations(pool);
    await ensureTestOperator(pool);

    const user = await pool.query<{ email: string }>(
      "SELECT email FROM users WHERE email = $1",
      [TEST_OPERATOR_EMAIL],
    );
    expect(user.rows).toHaveLength(1);
  });
});
