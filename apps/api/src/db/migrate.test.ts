import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getWorkspaceCount, runMigrations, workspaceExists } from "./migrate.js";
import { MIGRATIONS } from "./migrations.js";

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

  it("aborts migration 010 when duplicate invoice numbers exist within a Workspace", async () => {
    const migration = MIGRATIONS.find(
      (m) => m.id === "010_workspace_invoice_numbering",
    );
    expect(migration?.preCheck).toBeTypeOf("function");

    const duplicateNumber = "DUPE2026999";
    let clientAId: string | undefined;
    let clientBId: string | undefined;

    await pool.query(
      "DROP INDEX IF EXISTS invoices_workspace_invoice_number_unique_idx",
    );

    try {
      clientAId = (
        await pool.query<{ id: string }>(
          `
            INSERT INTO clients (workspace_id, name, default_rate)
            VALUES ($1, 'DupClientA', 60)
            RETURNING id
          `,
          [DEFAULT_WORKSPACE_ID],
        )
      ).rows[0]!.id;

      clientBId = (
        await pool.query<{ id: string }>(
          `
            INSERT INTO clients (workspace_id, name, default_rate)
            VALUES ($1, 'DupClientB', 60)
            RETURNING id
          `,
          [DEFAULT_WORKSPACE_ID],
        )
      ).rows[0]!.id;

      const insertInvoice = (clientId: string) =>
        pool.query(
          `
            INSERT INTO invoices (
              workspace_id,
              client_id,
              invoice_number,
              period_start,
              period_end,
              invoice_date,
              due_date,
              total_amount,
              total_duration_minutes
            )
            VALUES ($1, $2, $3, '2026-06-01', '2026-06-30', '2026-06-30', '2026-07-14', 60, 60)
          `,
          [DEFAULT_WORKSPACE_ID, clientId, duplicateNumber],
        );

      await insertInvoice(clientAId);
      await insertInvoice(clientBId);

      await expect(migration!.preCheck!(pool)).rejects.toThrow(
        `Migration 010 aborted: duplicate invoice_number "${duplicateNumber}" exists within a Workspace. Resolve cross-Client duplicates before migrating.`,
      );
    } finally {
      if (clientAId || clientBId) {
        await pool.query(
          "DELETE FROM invoices WHERE invoice_number = $1",
          [duplicateNumber],
        );
      }
      if (clientAId) {
        await pool.query("DELETE FROM clients WHERE id = $1", [clientAId]);
      }
      if (clientBId) {
        await pool.query("DELETE FROM clients WHERE id = $1", [clientBId]);
      }
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS invoices_workspace_invoice_number_unique_idx
          ON invoices (workspace_id, invoice_number)
      `);
    }
  });
});
