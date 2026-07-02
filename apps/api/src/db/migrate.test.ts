import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getWorkspaceCount, runMigrations, workspaceExists } from "./migrate.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("database migrations", () => {
  const pool = new Pool({ connectionString: databaseUrl });

  beforeAll(async () => {
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a seeded workspace row", async () => {
    expect(await getWorkspaceCount(pool)).toBeGreaterThanOrEqual(1);
    expect(await workspaceExists(pool, DEFAULT_WORKSPACE_ID)).toBe(true);
  });
});
