import {
  isValidInvoicePrefix,
  nextInvoiceNumber,
  nextPrefixedInvoiceNumber,
  normalizeInvoicePrefix,
  type InvoiceIssuanceSnapshot,
  type InvoiceNumberingStrategy,
} from "@hourden/domain";
import type { Pool } from "pg";
import {
  billingMonthKey,
  getInvoiceNumberingStrategy,
  getIssuedInvoiceById,
  getWorkspaceInvoiceNumberingStrategy,
  invoiceNumberFormat,
  listInvoiceNumbersForClientYear,
  listPlainInvoiceNumbersForWorkspaceYear,
  mapInvoiceInsertError,
  mapIssuedInvoiceDetail,
  resolveInvoiceNumberSeparatorStyle,
  resolveInvoicePrefix,
  setInvoiceNumberingStrategy,
  setWorkspaceInvoiceNumberingStrategy,
  type CreateInvoiceResult,
  type InvoiceRow,
  type IssuedInvoiceDbRow,
  type IssuedInvoiceDetail,
} from "./invoices.js";

export async function createInvoice(
  pool: Pool,
  input: {
    workspaceId: string;
    clientId: string;
    client: { name: string; invoicePrefix: string | null };
    invoiceYear: number;
    periodStart: string;
    periodEnd: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    totalDurationMinutes: number;
    entryIds: string[];
    snapshot: InvoiceIssuanceSnapshot;
    invoiceNumber?: string;
    invoicePrefix?: string;
    numberingStrategy?: InvoiceNumberingStrategy;
    usePrefix?: boolean;
    invoiceNumberSeqBeforeYear?: boolean;
  },
): Promise<CreateInvoiceResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedClient = await client.query<{
      id: string;
      name: string;
      invoice_prefix: string | null;
    }>(
      `
        SELECT id, name, invoice_prefix
        FROM clients
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE
      `,
      [input.clientId, input.workspaceId],
    );
    if (!lockedClient.rows[0]) {
      await client.query("ROLLBACK");
      return "duplicate_period";
    }

    const prefix = input.invoicePrefix
      ? normalizeInvoicePrefix(input.invoicePrefix)
      : resolveInvoicePrefix({
          name: lockedClient.rows[0].name,
          invoicePrefix: lockedClient.rows[0].invoice_prefix,
        });

    if (!isValidInvoicePrefix(prefix)) {
      await client.query("ROLLBACK");
      return "invalid_prefix";
    }

    const { year, month } = billingMonthKey(input.periodEnd);
    const existingMonth = await client.query(
      `
        SELECT 1
        FROM invoices
        WHERE client_id = $1
          AND EXTRACT(YEAR FROM period_end) = $2
          AND EXTRACT(MONTH FROM period_end) = $3
          AND status <> 'voided'
        LIMIT 1
      `,
      [input.clientId, year, month],
    );
    if (existingMonth.rows.length > 0) {
      await client.query("ROLLBACK");
      return "duplicate_month";
    }

    const usePrefix = input.usePrefix ?? true;
    const invoiceNumberSeqBeforeYear = input.invoiceNumberSeqBeforeYear ?? false;
    const format = invoiceNumberFormat(invoiceNumberSeqBeforeYear);
    const separatorStyle = await resolveInvoiceNumberSeparatorStyle(
      client,
      input.clientId,
      format,
    );
    const existingNumbers = await listInvoiceNumbersForClientYear(
      client,
      input.clientId,
      input.invoiceYear,
    );
    const plainNumbers = await listPlainInvoiceNumbersForWorkspaceYear(
      client,
      input.workspaceId,
      input.invoiceYear,
    );
    let invoiceNumber = input.invoiceNumber;
    if (!invoiceNumber) {
      if (!usePrefix) {
        const strategy = await getWorkspaceInvoiceNumberingStrategy(
          client,
          input.workspaceId,
          input.invoiceYear,
        );
        invoiceNumber = nextInvoiceNumber(
          plainNumbers,
          input.invoiceYear,
          strategy,
          format,
          separatorStyle,
        );
      } else {
        const strategy = await getInvoiceNumberingStrategy(
          client,
          input.clientId,
          input.invoiceYear,
        );
        invoiceNumber = nextPrefixedInvoiceNumber(
          existingNumbers,
          prefix,
          input.invoiceYear,
          strategy,
          format,
          separatorStyle,
        );
      }
    }

    const workspaceDuplicate = await client.query(
      `
        SELECT 1
        FROM invoices
        WHERE workspace_id = $1 AND invoice_number = $2
        LIMIT 1
      `,
      [input.workspaceId, invoiceNumber],
    );
    if (workspaceDuplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return "duplicate_number";
    }

    if (input.numberingStrategy) {
      if (usePrefix) {
        await setInvoiceNumberingStrategy(
          client,
          input.clientId,
          input.invoiceYear,
          input.numberingStrategy,
        );
      } else {
        await setWorkspaceInvoiceNumberingStrategy(
          client,
          input.workspaceId,
          input.invoiceYear,
          input.numberingStrategy,
        );
      }
    }

    await client.query(
      `
        UPDATE clients
        SET invoice_prefix = $1,
            invoice_number_seq_before_year = $2,
            updated_at = now()
        WHERE id = $3
      `,
      [prefix, invoiceNumberSeqBeforeYear, input.clientId],
    );

    const invoiceResult = await client.query<InvoiceRow>(
      `
        INSERT INTO invoices (
          workspace_id,
          client_id,
          invoice_number,
          period_start,
          period_end,
          invoice_date,
          due_date,
          total_amount,
          total_duration_minutes,
          snapshot
        )
        VALUES ($1, $2, $3, $4::date, $5::date, $6::date, $7::date, $8, $9, $10::jsonb)
        RETURNING id, invoice_number, period_start::text, period_end::text
      `,
      [
        input.workspaceId,
        input.clientId,
        invoiceNumber,
        input.periodStart,
        input.periodEnd,
        input.invoiceDate,
        input.dueDate,
        input.totalAmount,
        input.totalDurationMinutes,
        JSON.stringify(input.snapshot),
      ],
    );

    const invoice = invoiceResult.rows[0]!;

    const updatedEntries = await client.query(
      `
        UPDATE time_entries
        SET invoice_id = $1, updated_at = now()
        WHERE id = ANY($2::uuid[]) AND workspace_id = $3 AND invoice_id IS NULL
      `,
      [invoice.id, input.entryIds, input.workspaceId],
    );

    if (updatedEntries.rowCount !== input.entryIds.length) {
      await client.query("ROLLBACK");
      return "duplicate_period";
    }

    await client.query("COMMIT");
    return invoice;
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapInvoiceInsertError(error);
    if (mapped === "throw") {
      throw error;
    }
    return mapped;
  } finally {
    client.release();
  }
}

export type MarkInvoiceSentResult =
  | IssuedInvoiceDetail
  | "not_found"
  | "not_issued";

export async function markInvoiceSent(
  pool: Pool,
  workspaceId: string,
  invoiceId: string,
): Promise<MarkInvoiceSentResult> {
  const updated = await pool.query<{ id: string }>(
    `
      UPDATE invoices
      SET status = 'sent'
      WHERE id = $1
        AND workspace_id = $2
        AND status = 'issued'
        AND snapshot IS NOT NULL
      RETURNING id
    `,
    [invoiceId, workspaceId],
  );

  if (updated.rows[0]) {
    const detail = await getIssuedInvoiceById(pool, workspaceId, invoiceId);
    return detail ?? "not_found";
  }

  const existing = await pool.query<{ status: string }>(
    `
      SELECT status
      FROM invoices
      WHERE id = $1 AND workspace_id = $2
    `,
    [invoiceId, workspaceId],
  );
  if (!existing.rows[0]) return "not_found";
  return "not_issued";
}

export type VoidInvoiceResult =
  | IssuedInvoiceDetail
  | "not_found"
  | "not_sent";

export async function voidInvoice(
  pool: Pool,
  workspaceId: string,
  invoiceId: string,
): Promise<VoidInvoiceResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{
      status: string;
    }>(
      `
        SELECT status
        FROM invoices
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE
      `,
      [invoiceId, workspaceId],
    );
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return "not_found";
    }
    if (existing.rows[0].status !== "sent") {
      await client.query("ROLLBACK");
      return "not_sent";
    }

    await client.query(
      `
        UPDATE time_entries
        SET invoice_id = NULL, updated_at = now()
        WHERE invoice_id = $1 AND workspace_id = $2
      `,
      [invoiceId, workspaceId],
    );

    const result = await client.query<IssuedInvoiceDbRow>(
      `
        UPDATE invoices i
        SET status = 'voided'
        FROM clients c
        WHERE i.id = $1
          AND i.workspace_id = $2
          AND c.id = i.client_id
        RETURNING
          i.id,
          i.client_id,
          c.name AS client_name,
          i.invoice_number,
          i.period_start::text,
          i.period_end::text,
          i.invoice_date::text,
          i.due_date::text,
          i.total_amount::text,
          i.snapshot,
          i.status
      `,
      [invoiceId, workspaceId],
    );

    await client.query("COMMIT");
    return mapIssuedInvoiceDetail(result.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type UpdateIssuedInvoiceResult =
  | IssuedInvoiceDetail
  | "not_found"
  | "not_issued"
  | "client_not_found"
  | "entries_unavailable"
  | "duplicate_period"
  | "duplicate_number"
  | "duplicate_month"
  | "invalid_prefix";

export async function updateIssuedInvoice(
  pool: Pool,
  input: {
    workspaceId: string;
    invoiceId: string;
    clientId: string;
    client: { name: string; invoicePrefix: string | null };
    invoiceYear: number;
    periodStart: string;
    periodEnd: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    totalDurationMinutes: number;
    entryIds: string[];
    snapshot: InvoiceIssuanceSnapshot;
    invoiceNumber?: string;
    invoicePrefix?: string;
    numberingStrategy?: InvoiceNumberingStrategy;
    usePrefix?: boolean;
    invoiceNumberSeqBeforeYear?: boolean;
  },
): Promise<UpdateIssuedInvoiceResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{
      status: string;
      invoice_number: string;
    }>(
      `
        SELECT status, invoice_number
        FROM invoices
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE
      `,
      [input.invoiceId, input.workspaceId],
    );
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return "not_found";
    }
    if (existing.rows[0].status !== "issued") {
      await client.query("ROLLBACK");
      return "not_issued";
    }

    const lockedClient = await client.query<{
      id: string;
      name: string;
      invoice_prefix: string | null;
    }>(
      `
        SELECT id, name, invoice_prefix
        FROM clients
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE
      `,
      [input.clientId, input.workspaceId],
    );
    if (!lockedClient.rows[0]) {
      await client.query("ROLLBACK");
      return "client_not_found";
    }

    const prefix = input.invoicePrefix
      ? normalizeInvoicePrefix(input.invoicePrefix)
      : resolveInvoicePrefix({
          name: lockedClient.rows[0].name,
          invoicePrefix: lockedClient.rows[0].invoice_prefix,
        });

    if (!isValidInvoicePrefix(prefix)) {
      await client.query("ROLLBACK");
      return "invalid_prefix";
    }

    const { year, month } = billingMonthKey(input.periodEnd);
    const existingMonth = await client.query(
      `
        SELECT 1
        FROM invoices
        WHERE client_id = $1
          AND EXTRACT(YEAR FROM period_end) = $2
          AND EXTRACT(MONTH FROM period_end) = $3
          AND status <> 'voided'
          AND id <> $4
        LIMIT 1
      `,
      [input.clientId, year, month, input.invoiceId],
    );
    if (existingMonth.rows.length > 0) {
      await client.query("ROLLBACK");
      return "duplicate_month";
    }

    const usePrefix = input.usePrefix ?? true;
    const invoiceNumberSeqBeforeYear = input.invoiceNumberSeqBeforeYear ?? false;
    const format = invoiceNumberFormat(invoiceNumberSeqBeforeYear);
    const separatorStyle = await resolveInvoiceNumberSeparatorStyle(
      client,
      input.clientId,
      format,
    );
    const existingNumbers = await listInvoiceNumbersForClientYear(
      client,
      input.clientId,
      input.invoiceYear,
    );
    const plainNumbers = await listPlainInvoiceNumbersForWorkspaceYear(
      client,
      input.workspaceId,
      input.invoiceYear,
    );
    let invoiceNumber = input.invoiceNumber;
    if (!invoiceNumber) {
      if (!usePrefix) {
        const strategy = await getWorkspaceInvoiceNumberingStrategy(
          client,
          input.workspaceId,
          input.invoiceYear,
        );
        invoiceNumber = nextInvoiceNumber(
          plainNumbers,
          input.invoiceYear,
          strategy,
          format,
          separatorStyle,
        );
      } else {
        const strategy = await getInvoiceNumberingStrategy(
          client,
          input.clientId,
          input.invoiceYear,
        );
        invoiceNumber = nextPrefixedInvoiceNumber(
          existingNumbers,
          prefix,
          input.invoiceYear,
          strategy,
          format,
          separatorStyle,
        );
      }
    }

    const workspaceDuplicate = await client.query(
      `
        SELECT 1
        FROM invoices
        WHERE workspace_id = $1 AND invoice_number = $2 AND id <> $3
        LIMIT 1
      `,
      [input.workspaceId, invoiceNumber, input.invoiceId],
    );
    if (workspaceDuplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return "duplicate_number";
    }

    if (input.numberingStrategy) {
      if (usePrefix) {
        await setInvoiceNumberingStrategy(
          client,
          input.clientId,
          input.invoiceYear,
          input.numberingStrategy,
        );
      } else {
        await setWorkspaceInvoiceNumberingStrategy(
          client,
          input.workspaceId,
          input.invoiceYear,
          input.numberingStrategy,
        );
      }
    }

    await client.query(
      `
        UPDATE clients
        SET invoice_prefix = $1,
            invoice_number_seq_before_year = $2,
            updated_at = now()
        WHERE id = $3
      `,
      [prefix, invoiceNumberSeqBeforeYear, input.clientId],
    );

    await client.query(
      `
        UPDATE time_entries
        SET invoice_id = NULL, updated_at = now()
        WHERE invoice_id = $1 AND workspace_id = $2
      `,
      [input.invoiceId, input.workspaceId],
    );

    const updated = await client.query<IssuedInvoiceDbRow>(
      `
        UPDATE invoices i
        SET
          client_id = $3,
          invoice_number = $4,
          period_start = $5::date,
          period_end = $6::date,
          invoice_date = $7::date,
          due_date = $8::date,
          total_amount = $9,
          total_duration_minutes = $10,
          snapshot = $11::jsonb
        FROM clients c
        WHERE i.id = $1
          AND i.workspace_id = $2
          AND c.id = $3
        RETURNING
          i.id,
          i.client_id,
          c.name AS client_name,
          i.invoice_number,
          i.period_start::text,
          i.period_end::text,
          i.invoice_date::text,
          i.due_date::text,
          i.total_amount::text,
          i.snapshot,
          i.status
      `,
      [
        input.invoiceId,
        input.workspaceId,
        input.clientId,
        invoiceNumber,
        input.periodStart,
        input.periodEnd,
        input.invoiceDate,
        input.dueDate,
        input.totalAmount,
        input.totalDurationMinutes,
        JSON.stringify(input.snapshot),
      ],
    );

    const updatedEntries = await client.query(
      `
        UPDATE time_entries
        SET invoice_id = $1, updated_at = now()
        WHERE id = ANY($2::uuid[]) AND workspace_id = $3 AND invoice_id IS NULL
      `,
      [input.invoiceId, input.entryIds, input.workspaceId],
    );

    if (updatedEntries.rowCount !== input.entryIds.length) {
      await client.query("ROLLBACK");
      return "entries_unavailable";
    }

    await client.query("COMMIT");
    return mapIssuedInvoiceDetail(updated.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapInvoiceInsertError(error);
    if (mapped === "throw" || typeof mapped === "object") {
      throw error;
    }
    return mapped;
  } finally {
    client.release();
  }
}
