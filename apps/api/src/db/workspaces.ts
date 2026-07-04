import { DEFAULT_REPORT_TIMEZONE } from "@hourden/domain";
import type { InvoiceOperator } from "@hourden/domain/invoice-pdf";
import type { Pool } from "pg";
import { hashPassword, validatePassword } from "../auth/password.js";

const EMPTY_INVOICE_OPERATOR: InvoiceOperator = {
  name: "",
  street: "",
  city: "",
  taxNumber: "",
  email: "",
  phone: "",
  bankName: "",
  iban: "",
  bic: "",
};

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

export function isInvoiceSenderConfigured(
  row: WorkspaceSettingsRow | null,
): boolean {
  return row?.sender_name != null;
}

export function workspaceRowToInvoiceOperator(
  row: WorkspaceSettingsRow | null,
): InvoiceOperator {
  if (!isInvoiceSenderConfigured(row)) {
    return { ...EMPTY_INVOICE_OPERATOR };
  }

  return {
    name: row!.sender_name ?? "",
    street: row!.sender_street ?? "",
    city: row!.sender_city ?? "",
    taxNumber: row!.sender_tax_number ?? "",
    email: row!.sender_email ?? "",
    phone: row!.sender_phone ?? "",
    bankName: row!.sender_bank_name ?? "",
    iban: row!.sender_iban ?? "",
    bic: row!.sender_bic ?? "",
  };
}

export async function getWorkspaceInvoiceSenderStatus(
  pool: Pool,
  workspaceId: string,
): Promise<{ invoiceSender: InvoiceOperator; configured: boolean }> {
  const row = await getWorkspaceSettings(pool, workspaceId);
  return {
    invoiceSender: workspaceRowToInvoiceOperator(row),
    configured: isInvoiceSenderConfigured(row),
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

export type UpdateInvoiceSenderInput = {
  name?: string;
  street?: string;
  city?: string;
  taxNumber?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  iban?: string;
  bic?: string;
};

function normalizeOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateWorkspaceInvoiceSender(
  pool: Pool,
  workspaceId: string,
  input: UpdateInvoiceSenderInput,
): Promise<InvoiceOperator | null> {
  const current = await getWorkspaceSettings(pool, workspaceId);
  if (!current) {
    return null;
  }

  const next = {
    name:
      input.name !== undefined
        ? normalizeOptionalText(input.name)
        : current.sender_name,
    street:
      input.street !== undefined
        ? normalizeOptionalText(input.street)
        : current.sender_street,
    city:
      input.city !== undefined
        ? normalizeOptionalText(input.city)
        : current.sender_city,
    taxNumber:
      input.taxNumber !== undefined
        ? normalizeOptionalText(input.taxNumber)
        : current.sender_tax_number,
    email:
      input.email !== undefined
        ? normalizeOptionalText(input.email)
        : current.sender_email,
    phone:
      input.phone !== undefined
        ? normalizeOptionalText(input.phone)
        : current.sender_phone,
    bankName:
      input.bankName !== undefined
        ? normalizeOptionalText(input.bankName)
        : current.sender_bank_name,
    iban:
      input.iban !== undefined
        ? normalizeOptionalText(input.iban)
        : current.sender_iban,
    bic:
      input.bic !== undefined
        ? normalizeOptionalText(input.bic)
        : current.sender_bic,
  };

  await pool.query(
    `
      UPDATE workspaces
      SET
        sender_name = $2,
        sender_street = $3,
        sender_city = $4,
        sender_tax_number = $5,
        sender_email = $6,
        sender_phone = $7,
        sender_bank_name = $8,
        sender_iban = $9,
        sender_bic = $10
      WHERE id = $1
    `,
    [
      workspaceId,
      next.name,
      next.street,
      next.city,
      next.taxNumber,
      next.email,
      next.phone,
      next.bankName,
      next.iban,
      next.bic,
    ],
  );

  return getWorkspaceInvoiceOperator(pool, workspaceId);
}

export async function createUserWithWorkspace(
  pool: Pool,
  input: CreateUserWithWorkspaceInput,
): Promise<CreateUserWithWorkspaceResult> {
  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.ok) {
    throw new Error(passwordCheck.error);
  }

  const sender = {
    name:
      input.sender?.name !== undefined
        ? normalizeOptionalText(input.sender.name)
        : null,
    street:
      input.sender?.street !== undefined
        ? normalizeOptionalText(input.sender.street)
        : null,
    city:
      input.sender?.city !== undefined
        ? normalizeOptionalText(input.sender.city)
        : null,
    taxNumber:
      input.sender?.taxNumber !== undefined
        ? normalizeOptionalText(input.sender.taxNumber)
        : null,
    email:
      input.sender?.email !== undefined
        ? normalizeOptionalText(input.sender.email)
        : null,
    phone:
      input.sender?.phone !== undefined
        ? normalizeOptionalText(input.sender.phone)
        : null,
    bankName:
      input.sender?.bankName !== undefined
        ? normalizeOptionalText(input.sender.bankName)
        : null,
    iban:
      input.sender?.iban !== undefined
        ? normalizeOptionalText(input.sender.iban)
        : null,
    bic:
      input.sender?.bic !== undefined
        ? normalizeOptionalText(input.sender.bic)
        : null,
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
