import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";

export const MIGRATIONS = [
  {
    id: "001_workspaces",
    sql: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      INSERT INTO workspaces (id, name)
      VALUES ('${DEFAULT_WORKSPACE_ID}', 'Default Workspace')
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    id: "002_clients",
    sql: `
      CREATE TABLE IF NOT EXISTS clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id),
        name text NOT NULL,
        default_rate numeric(10, 2) NOT NULL,
        legal_name text,
        address_line1 text,
        address_line2 text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS clients_workspace_id_idx ON clients (workspace_id);
    `,
  },
] as const;
