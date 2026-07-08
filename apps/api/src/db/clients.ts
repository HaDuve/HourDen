import type { Client, CreateClientInput, UpdateClientInput } from "@hourden/domain";
import type { Pool } from "pg";

type ClientRow = {
  id: string;
  name: string;
  default_rate: string;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  invoice_prefix: string | null;
  invoice_number_seq_before_year: boolean;
};

function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    defaultRate: Number(row.default_rate),
    legalName: row.legal_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    invoicePrefix: row.invoice_prefix,
    invoiceNumberSeqBeforeYear: row.invoice_number_seq_before_year,
  };
}

export async function createClient(
  pool: Pool,
  workspaceId: string,
  input: CreateClientInput,
): Promise<Client> {
  const result = await pool.query<ClientRow>(
    `
      INSERT INTO clients (
        workspace_id,
        name,
        default_rate,
        legal_name,
        address_line1,
        address_line2
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, default_rate, legal_name, address_line1, address_line2, invoice_prefix, invoice_number_seq_before_year
    `,
    [
      workspaceId,
      input.name,
      input.defaultRate,
      input.legalName ?? null,
      input.addressLine1 ?? null,
      input.addressLine2 ?? null,
    ],
  );

  return rowToClient(result.rows[0]!);
}

export async function getClientById(
  pool: Pool,
  workspaceId: string,
  clientId: string,
): Promise<Client | null> {
  const result = await pool.query<ClientRow>(
    `
      SELECT id, name, default_rate, legal_name, address_line1, address_line2, invoice_prefix, invoice_number_seq_before_year
      FROM clients
      WHERE id = $1 AND workspace_id = $2
    `,
    [clientId, workspaceId],
  );

  return result.rows[0] ? rowToClient(result.rows[0]) : null;
}

export async function listClients(
  pool: Pool,
  workspaceId: string,
): Promise<Client[]> {
  const result = await pool.query<ClientRow>(
    `
      SELECT id, name, default_rate, legal_name, address_line1, address_line2, invoice_prefix, invoice_number_seq_before_year
      FROM clients
      WHERE workspace_id = $1
      ORDER BY name ASC
    `,
    [workspaceId],
  );

  return result.rows.map(rowToClient);
}

export async function updateClient(
  pool: Pool,
  workspaceId: string,
  clientId: string,
  input: UpdateClientInput,
): Promise<Client | null> {
  const assignments: string[] = [];
  const values: unknown[] = [clientId, workspaceId];

  const addField = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) addField("name", input.name);
  if (input.defaultRate !== undefined) addField("default_rate", input.defaultRate);
  if (input.legalName !== undefined) addField("legal_name", input.legalName);
  if (input.addressLine1 !== undefined) addField("address_line1", input.addressLine1);
  if (input.addressLine2 !== undefined) addField("address_line2", input.addressLine2);

  if (assignments.length === 0) {
    const existing = await pool.query<ClientRow>(
      `
        SELECT id, name, default_rate, legal_name, address_line1, address_line2, invoice_prefix, invoice_number_seq_before_year
        FROM clients
        WHERE id = $1 AND workspace_id = $2
      `,
      [clientId, workspaceId],
    );
    return existing.rows[0] ? rowToClient(existing.rows[0]) : null;
  }

  assignments.push("updated_at = now()");

  const result = await pool.query<ClientRow>(
    `
      UPDATE clients
      SET ${assignments.join(", ")}
      WHERE id = $1 AND workspace_id = $2
      RETURNING id, name, default_rate, legal_name, address_line1, address_line2, invoice_prefix, invoice_number_seq_before_year
    `,
    values,
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToClient(result.rows[0]);
}

export async function deleteClient(
  pool: Pool,
  workspaceId: string,
  clientId: string,
): Promise<"deleted" | "not_found" | "has_projects"> {
  const existing = await pool.query(
    "SELECT id FROM clients WHERE id = $1 AND workspace_id = $2",
    [clientId, workspaceId],
  );
  if (!existing.rows[0]) {
    return "not_found";
  }

  const projects = await pool.query(
    "SELECT 1 FROM projects WHERE client_id = $1 LIMIT 1",
    [clientId],
  );
  if (projects.rows.length > 0) {
    return "has_projects";
  }

  await pool.query(
    "DELETE FROM clients WHERE id = $1 AND workspace_id = $2",
    [clientId, workspaceId],
  );
  return "deleted";
}
