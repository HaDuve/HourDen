import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrationsForTests } from "./migrate-for-tests.js";
import { resetWorkspace } from "./reset-workspace.js";

const databaseUrl = process.env.DATABASE_URL;

async function workspaceScopedCounts(pool: Pool, workspaceId: string) {
  const [timeEntries, invoices, clientNumbering, workspaceNumbering, projects, clients] =
    await Promise.all([
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM time_entries WHERE workspace_id = $1",
        [workspaceId],
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM invoices WHERE workspace_id = $1",
        [workspaceId],
      ),
      pool.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM client_invoice_numbering
          WHERE client_id IN (SELECT id FROM clients WHERE workspace_id = $1)
        `,
        [workspaceId],
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM workspace_invoice_numbering WHERE workspace_id = $1",
        [workspaceId],
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM projects WHERE workspace_id = $1",
        [workspaceId],
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM clients WHERE workspace_id = $1",
        [workspaceId],
      ),
    ]);

  return {
    timeEntries: Number(timeEntries.rows[0]!.count),
    invoices: Number(invoices.rows[0]!.count),
    clientInvoiceNumbering: Number(clientNumbering.rows[0]!.count),
    workspaceInvoiceNumbering: Number(workspaceNumbering.rows[0]!.count),
    projects: Number(projects.rows[0]!.count),
    clients: Number(clients.rows[0]!.count),
  };
}

describe.skipIf(!databaseUrl)("resetWorkspace", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await runMigrationsForTests(pool);
  });

  afterAll(async () => {
    await resetWorkspace(pool, DEFAULT_WORKSPACE_ID);
    await pool.end();
  });

  it("clears all workspace-scoped rows in FK-safe order", async () => {
    const clientId = (
      await pool.query<{ id: string }>(
        `
          INSERT INTO clients (workspace_id, name, default_rate)
          VALUES ($1, 'ResetTestClient', 60)
          RETURNING id
        `,
        [DEFAULT_WORKSPACE_ID],
      )
    ).rows[0]!.id;

    const projectId = (
      await pool.query<{ id: string }>(
        `
          INSERT INTO projects (workspace_id, client_id, name)
          VALUES ($1, $2, 'ResetTestProject')
          RETURNING id
        `,
        [DEFAULT_WORKSPACE_ID, clientId],
      )
    ).rows[0]!.id;

    const invoiceId = (
      await pool.query<{ id: string }>(
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
          VALUES ($1, $2, 'RT2026001', '2026-06-01', '2026-06-30', '2026-06-30', '2026-07-14', 60, 60)
          RETURNING id
        `,
        [DEFAULT_WORKSPACE_ID, clientId],
      )
    ).rows[0]!.id;

    await pool.query(
      `
        INSERT INTO time_entries (
          workspace_id,
          project_id,
          invoice_id,
          started_at,
          ended_at,
          billable
        )
        VALUES ($1, $2, $3, '2026-06-01T09:00:00Z', '2026-06-01T10:00:00Z', true)
      `,
      [DEFAULT_WORKSPACE_ID, projectId, invoiceId],
    );

    await pool.query(
      `
        INSERT INTO client_invoice_numbering (client_id, invoice_year, strategy)
        VALUES ($1, 2026, 'sequential')
      `,
      [clientId],
    );

    await pool.query(
      `
        INSERT INTO workspace_invoice_numbering (workspace_id, invoice_year, strategy)
        VALUES ($1, 2026, 'sequential')
      `,
      [DEFAULT_WORKSPACE_ID],
    );

    const before = await workspaceScopedCounts(pool, DEFAULT_WORKSPACE_ID);
    expect(before.timeEntries).toBeGreaterThan(0);
    expect(before.invoices).toBeGreaterThan(0);
    expect(before.clientInvoiceNumbering).toBeGreaterThan(0);
    expect(before.workspaceInvoiceNumbering).toBeGreaterThan(0);
    expect(before.projects).toBeGreaterThan(0);
    expect(before.clients).toBeGreaterThan(0);

    await resetWorkspace(pool, DEFAULT_WORKSPACE_ID);

    expect(await workspaceScopedCounts(pool, DEFAULT_WORKSPACE_ID)).toEqual({
      timeEntries: 0,
      invoices: 0,
      clientInvoiceNumbering: 0,
      workspaceInvoiceNumbering: 0,
      projects: 0,
      clients: 0,
    });

    const workspace = await pool.query("SELECT id FROM workspaces WHERE id = $1", [
      DEFAULT_WORKSPACE_ID,
    ]);
    expect(workspace.rows).toHaveLength(1);
  });
});
