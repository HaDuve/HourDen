import type { Client, CreateClientInput, UpdateClientInput } from "@hourden/domain";
import type { Pool } from "pg";

type ClientRow = {
  id: string;
  name: string;
  default_rate: string;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
};

function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    defaultRate: Number(row.default_rate),
    legalName: row.legal_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
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
      RETURNING id, name, default_rate, legal_name, address_line1, address_line2
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

export async function listClients(
  pool: Pool,
  workspaceId: string,
): Promise<Client[]> {
  const result = await pool.query<ClientRow>(
    `
      SELECT id, name, default_rate, legal_name, address_line1, address_line2
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
        SELECT id, name, default_rate, legal_name, address_line1, address_line2
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
      RETURNING id, name, default_rate, legal_name, address_line1, address_line2
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
): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM clients WHERE id = $1 AND workspace_id = $2",
    [clientId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}
