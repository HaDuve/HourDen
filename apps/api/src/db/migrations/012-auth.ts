import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { DEFAULT_INVOICE_OPERATOR } from "@hourden/domain/invoice-pdf";
import type { Pool } from "pg";
import { hashPassword, validatePassword } from "../../auth/password.js";

export const AUTH_MIGRATION_SQL = `
  ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS sender_name text,
    ADD COLUMN IF NOT EXISTS sender_street text,
    ADD COLUMN IF NOT EXISTS sender_city text,
    ADD COLUMN IF NOT EXISTS sender_tax_number text,
    ADD COLUMN IF NOT EXISTS sender_email text,
    ADD COLUMN IF NOT EXISTS sender_phone text,
    ADD COLUMN IF NOT EXISTS sender_bank_name text,
    ADD COLUMN IF NOT EXISTS sender_iban text,
    ADD COLUMN IF NOT EXISTS sender_bic text,
    ADD COLUMN IF NOT EXISTS calendar_timezone text;

  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_workspace_id uuid NOT NULL REFERENCES workspaces(id),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

  CREATE TABLE IF NOT EXISTS workspace_memberships (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, workspace_id)
  );
`;

export async function seedAuthMigration(pool: Pool): Promise<void> {
  const operator = DEFAULT_INVOICE_OPERATOR;
  const senderName =
    process.env.HOURDEN_OPERATOR_NAME ?? operator.name;
  const senderEmail =
    process.env.HOURDEN_OPERATOR_EMAIL ?? operator.email;
  const timezone = process.env.HOURDEN_TIMEZONE ?? "Europe/Berlin";

  await pool.query(
    `
      UPDATE workspaces
      SET
        sender_name = COALESCE(sender_name, $2),
        sender_street = COALESCE(sender_street, $3),
        sender_city = COALESCE(sender_city, $4),
        sender_tax_number = COALESCE(sender_tax_number, $5),
        sender_email = COALESCE(sender_email, $6),
        sender_phone = COALESCE(sender_phone, $7),
        sender_bank_name = COALESCE(sender_bank_name, $8),
        sender_iban = COALESCE(sender_iban, $9),
        sender_bic = COALESCE(sender_bic, $10),
        calendar_timezone = COALESCE(calendar_timezone, $11)
      WHERE id = $1
    `,
    [
      DEFAULT_WORKSPACE_ID,
      senderName,
      operator.street,
      operator.city,
      operator.taxNumber,
      senderEmail,
      operator.phone,
      operator.bankName,
      operator.iban,
      operator.bic,
      timezone,
    ],
  );

  const email = process.env.HOURDEN_OPERATOR_EMAIL;
  const password = process.env.HOURDEN_OPERATOR_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "HOURDEN_OPERATOR_EMAIL and HOURDEN_OPERATOR_PASSWORD must be set before running auth migration",
    );
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    throw new Error(`Invalid HOURDEN_OPERATOR_PASSWORD: ${passwordCheck.error}`);
  }

  const passwordHash = await hashPassword(password);
  const normalizedEmail = email.toLowerCase();

  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [normalizedEmail],
  );

  let userId = existing.rows[0]?.id;

  if (!userId) {
    const inserted = await pool.query<{ id: string }>(
      `
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id
      `,
      [normalizedEmail, passwordHash],
    );
    userId = inserted.rows[0]!.id;
  }

  await pool.query(
    `
      INSERT INTO workspace_memberships (user_id, workspace_id, role)
      VALUES ($1, $2, 'owner')
      ON CONFLICT (user_id, workspace_id) DO NOTHING
    `,
    [userId, DEFAULT_WORKSPACE_ID],
  );
}
