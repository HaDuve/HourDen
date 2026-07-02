import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "@hourden/domain";
import type { Pool } from "pg";

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  color: string | null;
};

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    color: row.color,
  };
}

export async function createProject(
  pool: Pool,
  workspaceId: string,
  input: CreateProjectInput,
): Promise<Project | null> {
  const clientCheck = await pool.query(
    "SELECT id FROM clients WHERE id = $1 AND workspace_id = $2",
    [input.clientId, workspaceId],
  );
  if (!clientCheck.rows[0]) {
    return null;
  }

  const result = await pool.query<ProjectRow>(
    `
      INSERT INTO projects (workspace_id, client_id, name, color)
      VALUES ($1, $2, $3, $4)
      RETURNING id, client_id, name, color
    `,
    [workspaceId, input.clientId, input.name, input.color ?? null],
  );

  return rowToProject(result.rows[0]!);
}

export async function listProjects(
  pool: Pool,
  workspaceId: string,
  clientId?: string,
): Promise<Project[]> {
  const values: unknown[] = [workspaceId];
  let clientFilter = "";

  if (clientId) {
    values.push(clientId);
    clientFilter = `AND client_id = $${values.length}`;
  }

  const result = await pool.query<ProjectRow>(
    `
      SELECT id, client_id, name, color
      FROM projects
      WHERE workspace_id = $1 ${clientFilter}
      ORDER BY name ASC
    `,
    values,
  );

  return result.rows.map(rowToProject);
}

export async function updateProject(
  pool: Pool,
  workspaceId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project | null> {
  const assignments: string[] = [];
  const values: unknown[] = [projectId, workspaceId];

  const addField = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) addField("name", input.name);
  if (input.color !== undefined) addField("color", input.color);

  if (assignments.length === 0) {
    const existing = await pool.query<ProjectRow>(
      `
        SELECT id, client_id, name, color
        FROM projects
        WHERE id = $1 AND workspace_id = $2
      `,
      [projectId, workspaceId],
    );
    return existing.rows[0] ? rowToProject(existing.rows[0]) : null;
  }

  assignments.push("updated_at = now()");

  const result = await pool.query<ProjectRow>(
    `
      UPDATE projects
      SET ${assignments.join(", ")}
      WHERE id = $1 AND workspace_id = $2
      RETURNING id, client_id, name, color
    `,
    values,
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToProject(result.rows[0]);
}

export async function deleteProject(
  pool: Pool,
  workspaceId: string,
  projectId: string,
): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM projects WHERE id = $1 AND workspace_id = $2",
    [projectId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}
