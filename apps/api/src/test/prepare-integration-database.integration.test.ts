import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as passwordModule from "../auth/password.js";
import {
  prepareIntegrationDatabase,
  resetPrepareIntegrationDatabaseForTests,
} from "./prepare-integration-database.js";
import { TEST_OPERATOR_EMAIL } from "./operator-credentials.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("prepareIntegrationDatabase", () => {
  const pool = new Pool({ connectionString: databaseUrl });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    resetPrepareIntegrationDatabaseForTests();
  });

  it("runs migrations and seeds the operator once per call without re-hashing", async () => {
    await pool.query(
      "DELETE FROM workspace_memberships WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [TEST_OPERATOR_EMAIL],
    );
    await pool.query("DELETE FROM users WHERE email = $1", [TEST_OPERATOR_EMAIL]);

    const hashSpy = vi.spyOn(passwordModule, "hashPassword");
    await prepareIntegrationDatabase();
    expect(hashSpy).toHaveBeenCalledTimes(1);

    const user = await pool.query<{ email: string }>(
      "SELECT email FROM users WHERE email = $1",
      [TEST_OPERATOR_EMAIL],
    );
    expect(user.rows).toHaveLength(1);

    hashSpy.mockClear();
    await prepareIntegrationDatabase();
    expect(hashSpy).not.toHaveBeenCalled();
    hashSpy.mockRestore();
  });
});
