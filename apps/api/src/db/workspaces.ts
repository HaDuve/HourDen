import { DEFAULT_REPORT_TIMEZONE } from "@hourden/domain";
import {
  DEFAULT_INVOICE_OPERATOR,
  type InvoiceOperator,
} from "@hourden/domain/invoice-pdf";
import type { Pool } from "pg";
import { hashPassword, validatePassword } from "../auth/password.js";

export type WorkspaceSettingsRow = {
  sender_name: string | null;
  sender_street: string | null;
  sender_city: string | null;
  sender_tax_number: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  sender_bank_name: string | null;
  sender_iban: string | null;
  sender_bic: string | null;
  calendar_timezone: string | null;
};

export async function getWorkspaceSettings(
  pool: Pool,
  workspaceId: string,
): Promise<WorkspaceSettingsRow | null> {
  const result = await pool.query<WorkspaceSettingsRow>(
    `
      SELECT
        sender_name,
        sender_street,
        sender_city,
        sender_tax_number,
        sender_email,
        sender_phone,
        sender_bank_name,
        sender_iban,
        sender_bic,
        calendar_timezone
      FROM workspaces
      WHERE id = $1
    `,
    [workspaceId],
  );
  return result.rows[0] ?? null;
}

export function workspaceRowToInvoiceOperator(
  row: WorkspaceSettingsRow | null,
): InvoiceOperator {
  const defaults = DEFAULT_INVOICE_OPERATOR;
  return {
    name: row?.sender_name ?? defaults.name,
    street: row?.sender_street ?? defaults.street,
    city: row?.sender_city ?? defaults.city,
    taxNumber: row?.sender_tax_number ?? defaults.taxNumber,
    email: row?.sender_email ?? defaults.email,
    phone: row?.sender_phone ?? defaults.phone,
    bankName: row?.sender_bank_name ?? defaults.bankName,
    iban: row?.sender_iban ?? defaults.iban,
    bic: row?.sender_bic ?? defaults.bic,
  };
}

export async function getWorkspaceInvoiceOperator(
  pool: Pool,
  workspaceId: string,
): Promise<InvoiceOperator> {
  const row = await getWorkspaceSettings(pool, workspaceId);
  return workspaceRowToInvoiceOperator(row);
}

export async function getWorkspaceCalendarTimezone(
  pool: Pool,
  workspaceId: string,
): Promise<string> {
  const row = await getWorkspaceSettings(pool, workspaceId);
  return row?.calendar_timezone ?? DEFAULT_REPORT_TIMEZONE;
}

export async function getWorkspaceBillingContext(
  pool: Pool,
  workspaceId: string,
): Promise<{ operator: InvoiceOperator; calendarTimezone: string }> {
  const row = await getWorkspaceSettings(pool, workspaceId);
  return {
    operator: workspaceRowToInvoiceOperator(row),
    calendarTimezone: row?.calendar_timezone ?? DEFAULT_REPORT_TIMEZONE,
  };
}

export type CreateUserWithWorkspaceInput = {
  email: string;
  password: string;
  workspaceName: string;
  sender?: Partial<{
    name: string;
    street: string;
    city: string;
    taxNumber: string;
    email: string;
    phone: string;
    bankName: string;
    iban: string;
    bic: string;
  }>;
  calendarTimezone?: string;
};

export type CreateUserWithWorkspaceResult = {
  userId: string;
  workspaceId: string;
};

export async function createUserWithWorkspace(
  pool: Pool,
  input: CreateUserWithWorkspaceInput,
): Promise<CreateUserWithWorkspaceResult> {
  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.ok) {
    throw new Error(passwordCheck.error);
  }

  const defaults = DEFAULT_INVOICE_OPERATOR;
  const sender = {
    name: input.sender?.name ?? `${input.workspaceName} Sender`,
    street: input.sender?.street ?? defaults.street,
    city: input.sender?.city ?? defaults.city,
    taxNumber: input.sender?.taxNumber ?? defaults.taxNumber,
    email: input.sender?.email ?? input.email,
    phone: input.sender?.phone ?? defaults.phone,
    bankName: input.sender?.bankName ?? defaults.bankName,
    iban: input.sender?.iban ?? defaults.iban,
    bic: input.sender?.bic ?? defaults.bic,
  };
  const calendarTimezone =
    input.calendarTimezone ?? DEFAULT_REPORT_TIMEZONE;

  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = input.email.toLowerCase();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );
    if (existing.rows[0]) {
      throw new Error(`User already exists: ${normalizedEmail}`);
    }

    const userRow = await client.query<{ id: string }>(
      `
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id
      `,
      [normalizedEmail, passwordHash],
    );
    const userId = userRow.rows[0]!.id;

    const workspaceRow = await client.query<{ id: string }>(
      `
        INSERT INTO workspaces (
          id,
          name,
          sender_name,
          sender_street,
          sender_city,
          sender_tax_number,
          sender_email,
          sender_phone,
          sender_bank_name,
          sender_iban,
          sender_bic,
          calendar_timezone
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
      [
        input.workspaceName,
        sender.name,
        sender.street,
        sender.city,
        sender.taxNumber,
        sender.email,
        sender.phone,
        sender.bankName,
        sender.iban,
        sender.bic,
        calendarTimezone,
      ],
    );
    const workspaceId = workspaceRow.rows[0]!.id;

    await client.query(
      `
        INSERT INTO workspace_memberships (user_id, workspace_id, role)
        VALUES ($1, $2, 'owner')
      `,
      [userId, workspaceId],
    );

    await client.query("COMMIT");
    return { userId, workspaceId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
