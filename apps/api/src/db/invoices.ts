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
  toLocalDateKey,
  type Client,
  type GroupedReportLine,
  type InvoiceIssuanceSnapshot,
  type InvoiceNumberingStrategy,
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
  recipient: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
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
  if (dbError.constraint === "invoices_workspace_invoice_number_unique_idx") {
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

async function listPlainInvoiceNumbersForWorkspaceYear(
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
  client: { id: string; name: string; invoicePrefix: string | null },
  year: number,
  prefixOverride?: string,
  usePrefix = true,
): Promise<string> {
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
    return nextInvoiceNumber(existingNumbers, year, strategy);
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

  return nextPrefixedInvoiceNumber(existingNumbers, prefix, year, strategy);
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
): Promise<{
  exists: boolean;
  suggestedNumber: string;
  nextIfIssued: { sequential: string; fromLast: string };
}> {
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
      suggestedNumber: nextInvoiceNumber(plainNumbers, year, "sequential"),
      nextIfIssued: previewNextInvoiceNumbers(plainNumbers, year, invoiceNumber),
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
    ),
    nextIfIssued: previewNextPrefixedInvoiceNumbers(
      existingNumbers,
      prefix,
      year,
      invoiceNumber,
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
  }>(
    `
      SELECT id, name, default_rate, legal_name, address_line1, address_line2, invoice_prefix
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
        LIMIT 1
      `,
      [input.clientId, year, month],
    );
    if (existingMonth.rows.length > 0) {
      await client.query("ROLLBACK");
      return "duplicate_month";
    }

    const usePrefix = input.usePrefix ?? true;
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
        SET invoice_prefix = $1, updated_at = now()
        WHERE id = $2
      `,
      [prefix, input.clientId],
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

type IssuedInvoiceDbRow = {
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

function mapIssuedInvoiceDetail(row: IssuedInvoiceDbRow): IssuedInvoiceDetail {
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
      WHERE i.id = $1 AND i.workspace_id = $2 AND i.status = 'issued' AND i.snapshot IS NOT NULL
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
  filters?: { clientId?: string; year?: number },
): Promise<IssuedInvoiceDetail[]> {
  const conditions = [
    "i.workspace_id = $1",
    "i.status = 'issued'",
    "i.snapshot IS NOT NULL",
  ];
  const params: unknown[] = [workspaceId];
  let paramIndex = 2;

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
    invoice_number: string;
    period_start: string;
    period_end: string;
    total_amount: string;
    snapshot: InvoiceIssuanceSnapshot;
  }>(
    `
      SELECT
        i.id,
        i.invoice_number,
        i.period_start::text,
        i.period_end::text,
        i.total_amount::text,
        i.snapshot
      FROM invoices i
      WHERE i.workspace_id = $1 AND i.status = 'issued' AND i.snapshot IS NOT NULL
      ORDER BY i.invoice_date DESC, i.invoice_number DESC
    `,
    [workspaceId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    recipient: row.snapshot.recipient.legalName,
    invoiceNumber: row.invoice_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalAmount: Number(row.total_amount),
  }));
}
