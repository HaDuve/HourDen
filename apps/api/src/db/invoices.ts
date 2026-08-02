import {
  groupEntriesByDateAndDescription,
  deriveDefaultInvoicePrefix,
  isValidInvoiceNumber,
  isValidInvoicePrefix,
  nextInvoiceNumber,
  nextPrefixedInvoiceNumber,
  normalizeInvoicePrefix,
  previewNextInvoiceNumbers,
  previewNextPrefixedInvoiceNumbers,
  resolveSeparatorStyle,
  toLocalDateKey,
  type Client,
  type GroupedReportLine,
  type InvoiceIssuanceSnapshot,
  type InvoiceNumberingStrategy,
  type InvoiceNumberFormat,
  type InvoiceNumberSeparatorStyle,
} from "@hourden/domain";
import type { DatabaseError, Pool, PoolClient } from "pg";
import { reportTimeZone } from "./reports.js";

export function invoiceNumberFormat(seqBeforeYear: boolean): InvoiceNumberFormat {
  return seqBeforeYear ? "sequence_first" : "year_first";
}

async function getMostRecentInvoiceNumberForClient(
  executor: Pool | PoolClient,
  clientId: string,
): Promise<string | null> {
  const result = await executor.query<{ invoice_number: string }>(
    `
      SELECT invoice_number
      FROM invoices
      WHERE client_id = $1
      ORDER BY period_end DESC, invoice_date DESC, invoice_number DESC
      LIMIT 1
    `,
    [clientId],
  );

  return result.rows[0]?.invoice_number ?? null;
}

export async function resolveInvoiceNumberSeparatorStyle(
  executor: Pool | PoolClient,
  clientId: string,
  format: InvoiceNumberFormat,
): Promise<InvoiceNumberSeparatorStyle> {
  const lastIssuedInvoiceNumber = await getMostRecentInvoiceNumberForClient(
    executor,
    clientId,
  );
  return resolveSeparatorStyle(lastIssuedInvoiceNumber, format);
}

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

export type IssuedInvoiceDetail = {
  id: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  snapshot: InvoiceIssuanceSnapshot;
  status: string;
};

export type IssuedInvoiceListItem = {
  id: string;
  clientId: string;
  recipient: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: string;
};

export type CreateInvoiceResult =
  | InvoiceRow
  | "duplicate_period"
  | "duplicate_number"
  | "duplicate_month"
  | "invalid_prefix";

function durationMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

export function billingMonthKey(periodEnd: string): { year: number; month: number } {
  const [year, month] = periodEnd.split("-").map(Number);
  return { year: year!, month: month! };
}

export function mapInvoiceInsertError(error: unknown): CreateInvoiceResult | "throw" {
  const dbError = error as DatabaseError;
  if (dbError?.code !== "23505") {
    return "throw";
  }

  if (
    dbError.constraint?.includes("period_start") ||
    dbError.constraint === "invoices_client_id_period_start_period_end_key" ||
    dbError.constraint === "invoices_client_active_period_unique_idx"
  ) {
    return "duplicate_period";
  }
  if (dbError.constraint === "invoices_client_invoice_number_unique_idx") {
    return "duplicate_number";
  }
  if (dbError.constraint === "invoices_workspace_invoice_number_unique_idx") {
    return "duplicate_number";
  }

  return "throw";
}

export async function listInvoiceNumbersForClientYear(
  executor: Pool | PoolClient,
  clientId: string,
  year: number,
): Promise<string[]> {
  const result = await executor.query<{ invoice_number: string }>(
    `
      SELECT invoice_number
      FROM invoices
      WHERE client_id = $1 AND EXTRACT(YEAR FROM period_end) = $2
      ORDER BY invoice_number ASC
    `,
    [clientId, year],
  );

  return result.rows.map((row) => row.invoice_number);
}

export function resolveInvoicePrefix(client: {
  name: string;
  invoicePrefix: string | null;
}): string {
  if (client.invoicePrefix) {
    return client.invoicePrefix;
  }
  return deriveDefaultInvoicePrefix(client.name);
}

export async function listPlainInvoiceNumbersForWorkspaceYear(
  executor: Pool | PoolClient,
  workspaceId: string,
  year: number,
): Promise<string[]> {
  const result = await executor.query<{ invoice_number: string }>(
    `
      SELECT invoice_number
      FROM invoices
      WHERE workspace_id = $1 AND EXTRACT(YEAR FROM period_end) = $2
      ORDER BY invoice_number ASC
    `,
    [workspaceId, year],
  );

  return result.rows
    .map((row) => row.invoice_number)
    .filter((number) => isValidInvoiceNumber(number, year));
}

export async function peekNextInvoiceNumber(
  pool: Pool,
  workspaceId: string,
  client: {
    id: string;
    name: string;
    invoicePrefix: string | null;
    invoiceNumberSeqBeforeYear?: boolean;
  },
  year: number,
  prefixOverride?: string,
  usePrefix = true,
  invoiceNumberSeqBeforeYear = false,
): Promise<string> {
  const format = invoiceNumberFormat(invoiceNumberSeqBeforeYear);
  const separatorStyle = await resolveInvoiceNumberSeparatorStyle(
    pool,
    client.id,
    format,
  );

  if (!usePrefix) {
    const existingNumbers = await listPlainInvoiceNumbersForWorkspaceYear(
      pool,
      workspaceId,
      year,
    );
    const strategy = await getWorkspaceInvoiceNumberingStrategy(
      pool,
      workspaceId,
      year,
    );
    return nextInvoiceNumber(
      existingNumbers,
      year,
      strategy,
      format,
      separatorStyle,
    );
  }

  const prefix = prefixOverride
    ? normalizeInvoicePrefix(prefixOverride)
    : resolveInvoicePrefix(client);
  const existingNumbers = await listInvoiceNumbersForClientYear(
    pool,
    client.id,
    year,
  );
  const strategy = await getInvoiceNumberingStrategy(pool, client.id, year);

  return nextPrefixedInvoiceNumber(
    existingNumbers,
    prefix,
    year,
    strategy,
    format,
    separatorStyle,
  );
}

export async function getInvoiceNumberingStrategy(
  executor: Pool | PoolClient,
  clientId: string,
  year: number,
): Promise<InvoiceNumberingStrategy> {
  const result = await executor.query<{ strategy: InvoiceNumberingStrategy }>(
    `
      SELECT strategy
      FROM client_invoice_numbering
      WHERE client_id = $1 AND invoice_year = $2
    `,
    [clientId, year],
  );

  return result.rows[0]?.strategy ?? "sequential";
}

export async function setInvoiceNumberingStrategy(
  executor: Pool | PoolClient,
  clientId: string,
  year: number,
  strategy: InvoiceNumberingStrategy,
): Promise<void> {
  await executor.query(
    `
      INSERT INTO client_invoice_numbering (client_id, invoice_year, strategy)
      VALUES ($1, $2, $3)
      ON CONFLICT (client_id, invoice_year)
      DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = now()
    `,
    [clientId, year, strategy],
  );
}

export async function getWorkspaceInvoiceNumberingStrategy(
  executor: Pool | PoolClient,
  workspaceId: string,
  year: number,
): Promise<InvoiceNumberingStrategy> {
  const result = await executor.query<{ strategy: InvoiceNumberingStrategy }>(
    `
      SELECT strategy
      FROM workspace_invoice_numbering
      WHERE workspace_id = $1 AND invoice_year = $2
    `,
    [workspaceId, year],
  );

  return result.rows[0]?.strategy ?? "sequential";
}

export async function setWorkspaceInvoiceNumberingStrategy(
  executor: Pool | PoolClient,
  workspaceId: string,
  year: number,
  strategy: InvoiceNumberingStrategy,
): Promise<void> {
  await executor.query(
    `
      INSERT INTO workspace_invoice_numbering (workspace_id, invoice_year, strategy)
      VALUES ($1, $2, $3)
      ON CONFLICT (workspace_id, invoice_year)
      DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = now()
    `,
    [workspaceId, year, strategy],
  );
}

export async function invoiceNumberExistsInWorkspace(
  pool: Pool,
  workspaceId: string,
  invoiceNumber: string,
): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM invoices
      WHERE workspace_id = $1 AND invoice_number = $2
      LIMIT 1
    `,
    [workspaceId, invoiceNumber],
  );

  return result.rows.length > 0;
}

export async function getInvoiceNumberingPreview(
  pool: Pool,
  workspaceId: string,
  client: { id: string; name: string; invoicePrefix: string | null },
  year: number,
  invoiceNumber: string,
  prefix: string,
  usePrefix = true,
  invoiceNumberSeqBeforeYear = false,
): Promise<{
  exists: boolean;
  suggestedNumber: string;
  nextIfIssued: { sequential: string; fromLast: string };
}> {
  const format = invoiceNumberFormat(invoiceNumberSeqBeforeYear);
  const separatorStyle = await resolveInvoiceNumberSeparatorStyle(
    pool,
    client.id,
    format,
  );
  const exists = await invoiceNumberExistsInWorkspace(
    pool,
    workspaceId,
    invoiceNumber,
  );

  if (!usePrefix) {
    const plainNumbers = await listPlainInvoiceNumbersForWorkspaceYear(
      pool,
      workspaceId,
      year,
    );

    return {
      exists,
      suggestedNumber: nextInvoiceNumber(
        plainNumbers,
        year,
        "sequential",
        format,
        separatorStyle,
      ),
      nextIfIssued: previewNextInvoiceNumbers(
        plainNumbers,
        year,
        invoiceNumber,
        format,
      ),
    };
  }

  const existingNumbers = await listInvoiceNumbersForClientYear(
    pool,
    client.id,
    year,
  );

  return {
    exists,
    suggestedNumber: nextPrefixedInvoiceNumber(
      existingNumbers,
      prefix,
      year,
      "sequential",
      format,
      separatorStyle,
    ),
    nextIfIssued: previewNextPrefixedInvoiceNumbers(
      existingNumbers,
      prefix,
      year,
      invoiceNumber,
      format,
    ),
  };
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
    invoice_prefix: string | null;
    invoice_number_seq_before_year: boolean;
    recipient_email: string | null;
    email_greeting_name: string | null;
    invoice_email_subject: string | null;
    invoice_email_body: string | null;
  }>(
    `
      SELECT
        id, name, default_rate, legal_name, address_line1, address_line2,
        invoice_prefix, invoice_number_seq_before_year,
        recipient_email, email_greeting_name, invoice_email_subject, invoice_email_body
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
    invoicePrefix: row.invoice_prefix,
    invoiceNumberSeqBeforeYear: row.invoice_number_seq_before_year,
    recipientEmail: row.recipient_email,
    emailGreetingName: row.email_greeting_name,
    invoiceEmailSubject: row.invoice_email_subject,
    invoiceEmailBody: row.invoice_email_body,
  };
}

export async function findInvoiceForPeriod(
  pool: Pool,
  clientId: string,
  from: string,
  to: string,
  options?: { excludeInvoiceId?: string },
): Promise<InvoiceRow | null> {
  if (options?.excludeInvoiceId) {
    const result = await pool.query<InvoiceRow>(
      `
        SELECT id, invoice_number, period_start::text, period_end::text
        FROM invoices
        WHERE client_id = $1
          AND period_start = $2::date
          AND period_end = $3::date
          AND status <> 'voided'
          AND id <> $4::uuid
      `,
      [clientId, from, to, options.excludeInvoiceId],
    );
    return result.rows[0] ?? null;
  }

  const result = await pool.query<InvoiceRow>(
    `
      SELECT id, invoice_number, period_start::text, period_end::text
      FROM invoices
      WHERE client_id = $1
        AND period_start = $2::date
        AND period_end = $3::date
        AND status <> 'voided'
    `,
    [clientId, from, to],
  );

  return result.rows[0] ?? null;
}

export async function findInvoiceForBillingMonth(
  pool: Pool,
  clientId: string,
  periodEnd: string,
  options?: { excludeInvoiceId?: string },
): Promise<InvoiceRow | null> {
  const { year, month } = billingMonthKey(periodEnd);
  if (options?.excludeInvoiceId) {
    const result = await pool.query<InvoiceRow>(
      `
        SELECT id, invoice_number, period_start::text, period_end::text
        FROM invoices
        WHERE client_id = $1
          AND EXTRACT(YEAR FROM period_end) = $2
          AND EXTRACT(MONTH FROM period_end) = $3
          AND status <> 'voided'
          AND id <> $4::uuid
        LIMIT 1
      `,
      [clientId, year, month, options.excludeInvoiceId],
    );
    return result.rows[0] ?? null;
  }

  const result = await pool.query<InvoiceRow>(
    `
      SELECT id, invoice_number, period_start::text, period_end::text
      FROM invoices
      WHERE client_id = $1
        AND EXTRACT(YEAR FROM period_end) = $2
        AND EXTRACT(MONTH FROM period_end) = $3
        AND status <> 'voided'
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
  options?: { includeInvoiceId?: string },
): Promise<InvoiceableEntryRow[]> {
  const result = await pool.query<InvoiceableEntryRow>(
    `
      SELECT te.id, te.started_at, te.ended_at, te.description, te.amount
      FROM time_entries te
      INNER JOIN projects p ON p.id = te.project_id
      WHERE te.workspace_id = $1
        AND p.client_id = $2
        AND (
          te.invoice_id IS NULL
          OR ($6::uuid IS NOT NULL AND te.invoice_id = $6::uuid)
        )
        AND te.ended_at IS NOT NULL
        AND te.description IS NOT NULL
        AND trim(te.description) <> ''
        AND ((te.started_at AT TIME ZONE $5)::date >= $3::date)
        AND ((te.started_at AT TIME ZONE $5)::date <= $4::date)
      ORDER BY te.started_at ASC
    `,
    [
      workspaceId,
      clientId,
      from,
      to,
      timeZone,
      options?.includeInvoiceId ?? null,
    ],
  );

  return result.rows;
}

export async function hasStoppedEntriesWithoutProjectInPeriod(
  pool: Pool,
  workspaceId: string,
  from: string,
  to: string,
  timeZone = reportTimeZone(),
): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM time_entries te
        WHERE te.workspace_id = $1
          AND te.invoice_id IS NULL
          AND te.ended_at IS NOT NULL
          AND te.project_id IS NULL
          AND ((te.started_at AT TIME ZONE $4)::date >= $2::date)
          AND ((te.started_at AT TIME ZONE $4)::date <= $3::date)
      ) AS exists
    `,
    [workspaceId, from, to, timeZone],
  );

  return result.rows[0]?.exists ?? false;
}

export async function hasStoppedEntriesMissingDescriptionForClientInPeriod(
  pool: Pool,
  workspaceId: string,
  clientId: string,
  from: string,
  to: string,
  timeZone = reportTimeZone(),
): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM time_entries te
        INNER JOIN projects p ON p.id = te.project_id
        WHERE te.workspace_id = $1
          AND p.client_id = $2
          AND te.invoice_id IS NULL
          AND te.ended_at IS NOT NULL
          AND (te.description IS NULL OR trim(te.description) = '')
          AND ((te.started_at AT TIME ZONE $5)::date >= $3::date)
          AND ((te.started_at AT TIME ZONE $5)::date <= $4::date)
      ) AS exists
    `,
    [workspaceId, clientId, from, to, timeZone],
  );

  return result.rows[0]?.exists ?? false;
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


export type IssuedInvoiceDbRow = {
  id: string;
  client_id: string;
  client_name: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  snapshot: InvoiceIssuanceSnapshot;
  status: string;
};

export function mapIssuedInvoiceDetail(row: IssuedInvoiceDbRow): IssuedInvoiceDetail {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    invoiceNumber: row.invoice_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    totalAmount: Number(row.total_amount),
    snapshot: row.snapshot,
    status: row.status,
  };
}

export async function getIssuedInvoiceById(
  pool: Pool,
  workspaceId: string,
  invoiceId: string,
): Promise<IssuedInvoiceDetail | null> {
  const result = await pool.query<IssuedInvoiceDbRow>(
    `
      SELECT
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
      FROM invoices i
      INNER JOIN clients c ON c.id = i.client_id
      WHERE i.id = $1
        AND i.workspace_id = $2
        AND i.status IN ('issued', 'sent')
        AND i.snapshot IS NOT NULL
    `,
    [invoiceId, workspaceId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return mapIssuedInvoiceDetail(row);
}

export async function listIssuedInvoiceDetails(
  pool: Pool,
  workspaceId: string,
  filters?: {
    clientId?: string;
    year?: number;
    statuses?: Array<"issued" | "sent">;
  },
): Promise<IssuedInvoiceDetail[]> {
  const statuses = filters?.statuses ?? ["issued", "sent"];
  const conditions = [
    "i.workspace_id = $1",
    `i.status = ANY($2::text[])`,
    "i.snapshot IS NOT NULL",
  ];
  const params: unknown[] = [workspaceId, statuses];
  let paramIndex = 3;

  if (filters?.clientId) {
    conditions.push(`i.client_id = $${paramIndex++}`);
    params.push(filters.clientId);
  }
  if (filters?.year !== undefined) {
    conditions.push(`EXTRACT(YEAR FROM i.period_end) = $${paramIndex++}`);
    params.push(filters.year);
  }

  const result = await pool.query<IssuedInvoiceDbRow>(
    `
      SELECT
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
      FROM invoices i
      INNER JOIN clients c ON c.id = i.client_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.invoice_date DESC, i.invoice_number DESC
    `,
    params,
  );

  return result.rows.map(mapIssuedInvoiceDetail);
}

export async function listIssuedInvoices(
  pool: Pool,
  workspaceId: string,
): Promise<IssuedInvoiceListItem[]> {
  const result = await pool.query<{
    id: string;
    client_id: string;
    invoice_number: string;
    period_start: string;
    period_end: string;
    total_amount: string;
    snapshot: InvoiceIssuanceSnapshot;
    status: string;
  }>(
    `
      SELECT
        i.id,
        i.client_id,
        i.invoice_number,
        i.period_start::text,
        i.period_end::text,
        i.total_amount::text,
        i.snapshot,
        i.status
      FROM invoices i
      WHERE i.workspace_id = $1
        AND i.status IN ('issued', 'sent')
        AND i.snapshot IS NOT NULL
      ORDER BY i.period_end DESC, i.invoice_date DESC, i.invoice_number DESC
    `,
    [workspaceId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    recipient: row.snapshot.recipient.legalName,
    invoiceNumber: row.invoice_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalAmount: Number(row.total_amount),
    status: row.status,
  }));
}

