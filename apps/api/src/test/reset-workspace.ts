import type { Pool } from "pg";

const WORKSPACE_RESET_STATEMENTS = [
  "DELETE FROM time_entries WHERE workspace_id = $1",
  "DELETE FROM invoices WHERE workspace_id = $1",
  `
    DELETE FROM client_invoice_numbering
    WHERE client_id IN (SELECT id FROM clients WHERE workspace_id = $1)
  `,
  "DELETE FROM workspace_invoice_numbering WHERE workspace_id = $1",
  "DELETE FROM projects WHERE workspace_id = $1",
  "DELETE FROM clients WHERE workspace_id = $1",
] as const;

export async function resetWorkspace(pool: Pool, workspaceId: string): Promise<void> {
  for (const sql of WORKSPACE_RESET_STATEMENTS) {
    await pool.query(sql, [workspaceId]);
  }
}

/** Restores migration 010 index after schema-mutation tests. Serial-only; see migrate.test.ts. */
export async function ensureInvoicesWorkspaceInvoiceNumberUniqueIndex(
  pool: Pool,
): Promise<void> {
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_workspace_invoice_number_unique_idx
      ON invoices (workspace_id, invoice_number)
  `);
}
