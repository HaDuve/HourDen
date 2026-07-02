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
] as const;
