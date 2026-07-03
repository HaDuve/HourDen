import {
  groupEntriesByDateAndDescription,
  nextInvoiceNumber,
  toLocalDateKey,
  type Client,
  type GroupedReportLine,
  type InvoiceIssuanceSnapshot,
} from "@hourden/domain";
import type { DatabaseError, Pool, PoolClient } from "pg";
import { reportTimeZone } from "./reports.js";

type InvoiceableEntryRow = {
  id: string;
  started_at: Date;
  ended_at: Date;
  description: string | null;
  amount: string | null;
};

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
};

export type CreateInvoiceResult =
  | InvoiceRow
  | "duplicate_period"
  | "duplicate_number"
  | "duplicate_month";

function durationMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

function billingMonthKey(periodEnd: string): { year: number; month: number } {
  const [year, month] = periodEnd.split("-").map(Number);
  return { year: year!, month: month! };
}

function mapInvoiceInsertError(error: unknown): CreateInvoiceResult | "throw" {
  const dbError = error as DatabaseError;
  if (dbError?.code !== "23505") {
    return "throw";
  }

  if (
    dbError.constraint?.includes("period_start") ||
    dbError.constraint === "invoices_client_id_period_start_period_end_key"
  ) {
    return "duplicate_period";
  }
  if (dbError.constraint === "invoices_client_invoice_number_unique_idx") {
    return "duplicate_number";
  }

  return "throw";
}

async function listInvoiceNumbersForClientYear(
  executor: Pool | PoolClient,
  clientId: string,
  year: number,
): Promise<string[]> {
  const result = await executor.query<{ invoice_number: string }>(
    `
      SELECT invoice_number
      FROM invoices
      WHERE client_id = $1 AND invoice_number LIKE $2
      ORDER BY invoice_number ASC
    `,
    [clientId, `${year}%`],
  );

  return result.rows.map((row) => row.invoice_number);
}

export async function peekNextInvoiceNumber(
  pool: Pool,
  clientId: string,
  year: number,
): Promise<string> {
  const existingNumbers = await listInvoiceNumbersForClientYear(
    pool,
    clientId,
    year,
  );

  return nextInvoiceNumber(existingNumbers, year);
}

export async function getClientForInvoice(
  pool: Pool,
  workspaceId: string,
  clientId: string,
): Promise<Client | null> {
  const result = await pool.query<{
    id: string;
    name: string;
    default_rate: string;
    legal_name: string | null;
    address_line1: string | null;
    address_line2: string | null;
  }>(
    `
      SELECT id, name, default_rate, legal_name, address_line1, address_line2
      FROM clients
      WHERE id = $1 AND workspace_id = $2
    `,
    [clientId, workspaceId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    defaultRate: Number(row.default_rate),
    legalName: row.legal_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
  };
}

export async function findInvoiceForPeriod(
  pool: Pool,
  clientId: string,
  from: string,
  to: string,
): Promise<InvoiceRow | null> {
  const result = await pool.query<InvoiceRow>(
    `
      SELECT id, invoice_number, period_start::text, period_end::text
      FROM invoices
      WHERE client_id = $1 AND period_start = $2::date AND period_end = $3::date
    `,
    [clientId, from, to],
  );

  return result.rows[0] ?? null;
}

export async function findInvoiceForBillingMonth(
  pool: Pool,
  clientId: string,
  periodEnd: string,
): Promise<InvoiceRow | null> {
  const { year, month } = billingMonthKey(periodEnd);
  const result = await pool.query<InvoiceRow>(
    `
      SELECT id, invoice_number, period_start::text, period_end::text
      FROM invoices
      WHERE client_id = $1
        AND EXTRACT(YEAR FROM period_end) = $2
        AND EXTRACT(MONTH FROM period_end) = $3
      LIMIT 1
    `,
    [clientId, year, month],
  );

  return result.rows[0] ?? null;
}

export async function listInvoiceableEntriesForClient(
  pool: Pool,
  workspaceId: string,
  clientId: string,
  from: string,
  to: string,
  timeZone = reportTimeZone(),
): Promise<InvoiceableEntryRow[]> {
  const result = await pool.query<InvoiceableEntryRow>(
    `
      SELECT te.id, te.started_at, te.ended_at, te.description, te.amount
      FROM time_entries te
      INNER JOIN projects p ON p.id = te.project_id
      WHERE te.workspace_id = $1
        AND p.client_id = $2
        AND te.invoice_id IS NULL
        AND te.ended_at IS NOT NULL
        AND te.description IS NOT NULL
        AND trim(te.description) <> ''
        AND ((te.started_at AT TIME ZONE $5)::date >= $3::date)
        AND ((te.started_at AT TIME ZONE $5)::date <= $4::date)
      ORDER BY te.started_at ASC
    `,
    [workspaceId, clientId, from, to, timeZone],
  );

  return result.rows;
}

export function rowsToGroupedInvoiceLines(
  rows: InvoiceableEntryRow[],
  timeZone = reportTimeZone(),
): GroupedReportLine[] {
  return groupEntriesByDateAndDescription(
    rows.map((row) => ({
      date: toLocalDateKey(row.started_at, timeZone),
      description: row.description?.trim() ?? "",
      durationMinutes: durationMinutes(row.started_at, row.ended_at),
      amount: row.amount !== null ? Number(row.amount) : 0,
    })),
  );
}

export async function createInvoice(
  pool: Pool,
  input: {
    workspaceId: string;
    clientId: string;
    invoiceYear: number;
    periodStart: string;
    periodEnd: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    totalDurationMinutes: number;
    entryIds: string[];
    snapshot: InvoiceIssuanceSnapshot;
  },
): Promise<CreateInvoiceResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedClient = await client.query<{ id: string }>(
      `
        SELECT id
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

    const { year, month } = billingMonthKey(input.periodEnd);
    const existingMonth = await client.query(
      `
        SELECT 1
        FROM invoices
        WHERE client_id = $1
          AND EXTRACT(YEAR FROM period_end) = $2
          AND EXTRACT(MONTH FROM period_end) = $3
        LIMIT 1
      `,
      [input.clientId, year, month],
    );
    if (existingMonth.rows.length > 0) {
      await client.query("ROLLBACK");
      return "duplicate_month";
    }

    const existingNumbers = await listInvoiceNumbersForClientYear(
      client,
      input.clientId,
      input.invoiceYear,
    );
    const invoiceNumber = nextInvoiceNumber(existingNumbers, input.invoiceYear);

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
