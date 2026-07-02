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
  {
    id: "003_projects",
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id),
        client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
        name text NOT NULL,
        color text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON projects (workspace_id);
      CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects (client_id);
    `,
  },
  {
    id: "004_time_entries",
    sql: `
      CREATE TABLE IF NOT EXISTS time_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id),
        project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        description text,
        tags text[] NOT NULL DEFAULT '{}',
        billable boolean NOT NULL DEFAULT true,
        amount numeric(10, 2),
        invoice_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS time_entries_workspace_id_idx ON time_entries (workspace_id);
      CREATE INDEX IF NOT EXISTS time_entries_started_at_idx ON time_entries (workspace_id, started_at);
      CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_running_per_workspace_idx
        ON time_entries (workspace_id)
        WHERE ended_at IS NULL;
    `,
  },
  {
    id: "005_clockify_import_fingerprint",
    sql: `
      ALTER TABLE time_entries
        ADD COLUMN IF NOT EXISTS import_fingerprint text;

      CREATE UNIQUE INDEX IF NOT EXISTS time_entries_import_fingerprint_idx
        ON time_entries (workspace_id, import_fingerprint)
        WHERE import_fingerprint IS NOT NULL;
    `,
  },
  {
    id: "006_invoices",
    sql: `
      CREATE TABLE IF NOT EXISTS invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id),
        client_id uuid NOT NULL REFERENCES clients(id),
        invoice_number text NOT NULL,
        period_start date NOT NULL,
        period_end date NOT NULL,
        invoice_date date NOT NULL,
        due_date date NOT NULL,
        total_amount numeric(10, 2) NOT NULL,
        total_duration_minutes integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (client_id, period_start, period_end)
      );

      CREATE INDEX IF NOT EXISTS invoices_workspace_id_idx ON invoices (workspace_id);
      CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices (client_id);

      ALTER TABLE time_entries
        DROP CONSTRAINT IF EXISTS time_entries_invoice_id_fkey;

      ALTER TABLE time_entries
        ADD CONSTRAINT time_entries_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES invoices(id);
    `,
  },
  {
    id: "007_invoice_number_unique",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS invoices_client_invoice_number_unique_idx
        ON invoices (client_id, invoice_number);
    `,
  },
] as const;
