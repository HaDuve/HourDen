import {
  generateInvoicePdf,
  type InvoiceOperator,
} from "@hourden/domain/invoice-pdf";
import type { InvoiceIssuanceSnapshot } from "@hourden/domain/invoice-issuance-snapshot";
import type { GroupedReportLine, InvoiceBlockerCode, InvoiceNumberingStrategy } from "@hourden/domain";
import {
  isValidInvoiceNumber,
  isValidInvoicePrefix,
  isValidPrefixedInvoiceNumber,
  isValidAnyInvoiceNumber,
  normalizeInvoicePrefix,
} from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  createInvoice,
  findInvoiceForBillingMonth,
  findInvoiceForPeriod,
  getClientForInvoice,
  getIssuedInvoiceById,
  getInvoiceNumberingPreview,
  invoiceNumberExistsInWorkspace,
  listInvoiceableEntriesForClient,
  listIssuedInvoiceDetails,
  listIssuedInvoices,
  hasStoppedEntriesWithoutProjectInPeriod,
  hasStoppedEntriesMissingDescriptionForClientInPeriod,
  peekNextInvoiceNumber,
  resolveInvoicePrefix,
  rowsToGroupedInvoiceLines,
  type IssuedInvoiceDetail,
} from "./db/invoices.js";
import { buildIssuedInvoicesZip } from "./invoice-export.js";
import {
  invoiceFilename,
  invoiceRecipientCode,
} from "./invoice-path.js";
import { getWorkspaceCalendarTimezone, getWorkspaceInvoiceOperator } from "./db/workspaces.js";
import { getCurrentWorkspaceId } from "./workspace.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InvoiceRequestBody = {
  clientId?: string;
  from?: string;
  to?: string;
  invoiceNumber?: string;
  invoicePrefix?: string;
  numberingStrategy?: InvoiceNumberingStrategy;
  usePrefix?: boolean;
  usesSmallBusinessRule?: boolean;
};

type InvoiceClient = {
  id: string;
  name: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  invoicePrefix: string | null;
};

type PreparedInvoice = {
  workspaceId: string;
  client: InvoiceClient;
  range: { from: string; to: string };
  lines: GroupedReportLine[];
  totalAmount: number;
  totalDurationMinutes: number;
  invoiceYear: number;
  invoiceDate: string;
  dueDate: string;
  operator: InvoiceOperator;
  snapshot: InvoiceIssuanceSnapshot;
  entryIds: string[];
};

type PrepareInvoiceError = {
  error: string;
  code?: InvoiceBlockerCode;
  status: 400 | 404 | 409;
};

function parseDateRange(
  from: string | undefined,
  to: string | undefined,
): { from: string; to: string } | "invalid" {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return "invalid";
  }
  if (from > to) {
    return "invalid";
  }
  return { from, to };
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function prepareInvoice(
  pool: Pool,
  body: InvoiceRequestBody,
): Promise<PreparedInvoice | PrepareInvoiceError> {
  const range = parseDateRange(body.from, body.to);
  if (range === "invalid") {
    return {
      error: "from and to are required (YYYY-MM-DD) with from <= to",
      status: 400,
    };
  }

  if (!body.clientId) {
    return { error: "clientId is required", status: 400 };
  }

  const workspaceId = getCurrentWorkspaceId();
  const client = await getClientForInvoice(pool, workspaceId, body.clientId);
  if (!client) {
    return { error: "Client not found", status: 404 };
  }

  if (!client.legalName || !client.addressLine1 || !client.addressLine2) {
    return {
      error: "Client Recipient fields are required before invoicing",
      code: "MISSING_RECIPIENT",
      status: 400,
    };
  }

  const existingPeriod = await findInvoiceForPeriod(
    pool,
    client.id,
    range.from,
    range.to,
  );
  if (existingPeriod) {
    return {
      error: invoiceConflictMessage("duplicate_period"),
      status: 409,
    };
  }

  const existingMonth = await findInvoiceForBillingMonth(
    pool,
    client.id,
    range.to,
  );
  if (existingMonth) {
    return {
      error: invoiceConflictMessage("duplicate_month"),
      status: 409,
    };
  }

  const timeZone = await getWorkspaceCalendarTimezone(pool, workspaceId);
  const entryRows = await listInvoiceableEntriesForClient(
    pool,
    workspaceId,
    client.id,
    range.from,
    range.to,
    timeZone,
  );

  if (entryRows.length === 0) {
    if (
      await hasStoppedEntriesWithoutProjectInPeriod(
        pool,
        workspaceId,
        range.from,
        range.to,
        timeZone,
      )
    ) {
      return {
        error: "Time Entries in this Billing Period are not assigned to a Project",
        code: "ENTRIES_WITHOUT_PROJECT",
        status: 400,
      };
    }

    if (
      await hasStoppedEntriesMissingDescriptionForClientInPeriod(
        pool,
        workspaceId,
        client.id,
        range.from,
        range.to,
        timeZone,
      )
    ) {
      return {
        error: "Time Entries in this Billing Period need a Description before invoicing",
        code: "ENTRIES_MISSING_DESCRIPTION",
        status: 400,
      };
    }

    return {
      error: "No billable Time Entries in this Billing Period",
      code: "NO_BILLABLE_ENTRIES",
      status: 400,
    };
  }

  const lines = rowsToGroupedInvoiceLines(entryRows, timeZone);
  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const totalDurationMinutes = lines.reduce(
    (sum, line) => sum + line.durationMinutes,
    0,
  );

  const invoiceYear = Number(range.to.slice(0, 4));
  const invoiceDate = range.to;
  const dueDate = addDays(invoiceDate, 14);
  const operator = await getWorkspaceInvoiceOperator(pool, workspaceId);

  return {
    workspaceId,
    client: {
      id: client.id,
      name: client.name,
      legalName: client.legalName,
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2,
      invoicePrefix: client.invoicePrefix,
    },
    range,
    lines,
    totalAmount,
    totalDurationMinutes,
    invoiceYear,
    invoiceDate,
    dueDate,
    operator,
    snapshot: {
      recipient: {
        legalName: client.legalName,
        addressLine1: client.addressLine1,
        addressLine2: client.addressLine2,
      },
      operator,
      lines,
      totals: {
        totalAmount,
        totalDurationMinutes,
      },
    },
    entryIds: entryRows.map((row) => row.id),
  };
}

function invoiceConflictMessage(
  reason: "duplicate_period" | "duplicate_month" | "duplicate_number",
): string {
  if (reason === "duplicate_month") {
    return "Invoice already exists for this Client and billing month";
  }
  if (reason === "duplicate_number") {
    return "Invoice Number already exists in this Workspace";
  }
  return "Invoice already exists for this Client and Billing Period";
}

function parseUsePrefix(value: unknown): boolean {
  return value !== false;
}

function parseUsesSmallBusinessRule(value: unknown): boolean {
  return value !== false;
}

function withInvoiceOptions(
  prepared: PreparedInvoice,
  body: InvoiceRequestBody,
): PreparedInvoice {
  return {
    ...prepared,
    snapshot: {
      ...prepared.snapshot,
      usesSmallBusinessRule: parseUsesSmallBusinessRule(body.usesSmallBusinessRule),
    },
  };
}

function parseNumberingStrategy(
  value: string | undefined,
): InvoiceNumberingStrategy | "invalid" {
  if (value === undefined) {
    return "invalid";
  }
  if (value === "sequential" || value === "from_last") {
    return value;
  }
  return "invalid";
}

function invalidInvoiceNumberMessage(
  prefix: string,
  year: number,
): string {
  return `Invoice Number must be ${prefix}${year} followed by at least three digits, or ${year} followed by at least three digits for plain format`;
}

function isValidIssuedInvoiceNumber(
  invoiceNumber: string,
  year: number,
): boolean {
  return isValidAnyInvoiceNumber(invoiceNumber, year);
}

function resolveRequestInvoicePrefix(
  body: InvoiceRequestBody,
  client: { name: string; invoicePrefix: string | null },
): string {
  if (body.invoicePrefix) {
    return normalizeInvoicePrefix(body.invoicePrefix);
  }
  return resolveInvoicePrefix(client);
}

async function renderInvoicePdf(
  prepared: PreparedInvoice,
  invoiceNumber: string,
): Promise<Buffer> {
  return generateInvoicePdf({
    invoiceNumber,
    invoiceDate: prepared.invoiceDate,
    periodStart: prepared.range.from,
    periodEnd: prepared.range.to,
    dueDate: prepared.dueDate,
    recipient: prepared.snapshot.recipient,
    lines: prepared.snapshot.lines,
    operator: prepared.snapshot.operator,
    usesSmallBusinessRule: prepared.snapshot.usesSmallBusinessRule,
  });
}

async function renderInvoicePdfFromSnapshot(
  invoice: IssuedInvoiceDetail,
): Promise<Buffer> {
  return generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    dueDate: invoice.dueDate,
    recipient: invoice.snapshot.recipient,
    lines: invoice.snapshot.lines,
    operator: invoice.snapshot.operator,
    usesSmallBusinessRule: invoice.snapshot.usesSmallBusinessRule,
  });
}

function invoicePdfHeadersFromSnapshot(
  invoice: IssuedInvoiceDetail,
): Record<string, string> {
  const recipientCode = invoiceRecipientCode(invoice.clientName);
  const filename = invoiceFilename(
    invoice.invoiceNumber,
    invoice.periodEnd,
    recipientCode,
  );

  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Invoice-Number": invoice.invoiceNumber,
  };
}

function invoicePdfHeaders(
  invoiceNumber: string,
  prepared: PreparedInvoice,
): Record<string, string> {
  const recipientCode = invoiceRecipientCode(prepared.client.name);
  const filename = invoiceFilename(
    invoiceNumber,
    prepared.range.to,
    recipientCode,
  );

  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Invoice-Number": invoiceNumber,
  };
}

async function parseInvoiceBody(
  c: { req: { json: () => Promise<unknown> } },
): Promise<InvoiceRequestBody | "invalid_json"> {
  try {
    return (await c.req.json()) as InvoiceRequestBody;
  } catch {
    return "invalid_json";
  }
}

function parseExportFilters(
  clientId: string | undefined,
  year: string | undefined,
): { clientId?: string; year?: number } | "invalid_year" | "invalid_client" {
  const filters: { clientId?: string; year?: number } = {};

  if (clientId) {
    if (!UUID_RE.test(clientId)) {
      return "invalid_client";
    }
    filters.clientId = clientId;
  }

  if (year !== undefined) {
    if (!/^\d{4}$/.test(year)) {
      return "invalid_year";
    }
    filters.year = Number(year);
  }

  return filters;
}

export function createInvoicesRouter(pool: Pool) {
  const router = new Hono();

  router.get("/numbering-preview", async (c) => {
    const clientId = c.req.query("clientId");
    const invoiceNumber = c.req.query("invoiceNumber");
    const yearParam = c.req.query("year");
    const prefixParam = c.req.query("invoicePrefix");
    const usePrefix = c.req.query("usePrefix") !== "false";

    if (!clientId || !UUID_RE.test(clientId)) {
      return c.json({ error: "clientId is required" }, 400);
    }
    if (!invoiceNumber) {
      return c.json({ error: "invoiceNumber is required" }, 400);
    }
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      return c.json({ error: "year must be a four-digit calendar year" }, 400);
    }

    const year = Number(yearParam);
    const client = await getClientForInvoice(
      pool,
      getCurrentWorkspaceId(),
      clientId,
    );
    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    const prefix = prefixParam
      ? normalizeInvoicePrefix(prefixParam)
      : resolveInvoicePrefix(client);
    if (!isValidInvoicePrefix(prefix)) {
      return c.json({ error: "invoicePrefix must be 1-6 letters or digits" }, 400);
    }
    if (!isValidIssuedInvoiceNumber(invoiceNumber, year)) {
      return c.json({ error: invalidInvoiceNumberMessage(prefix, year) }, 400);
    }

    const preview = await getInvoiceNumberingPreview(
      pool,
      getCurrentWorkspaceId(),
      client,
      year,
      invoiceNumber,
      prefix,
      usePrefix,
    );

    return c.json(preview);
  });

  router.get("/export.zip", async (c) => {
    const yearParam = c.req.query("year");
    const filters = parseExportFilters(c.req.query("client"), yearParam);
    if (filters === "invalid_year") {
      return c.json({ error: "year must be a four-digit calendar year" }, 400);
    }
    if (filters === "invalid_client") {
      return c.json({ error: "client must be a valid client id" }, 400);
    }

    const invoices = await listIssuedInvoiceDetails(
      pool,
      getCurrentWorkspaceId(),
      filters,
    );
    const zip = await buildIssuedInvoicesZip(invoices, renderInvoicePdfFromSnapshot);

    c.header("Content-Type", "application/zip");
    c.header("Content-Disposition", 'attachment; filename="Outgoing.zip"');
    return c.body(new Uint8Array(zip), 200);
  });

  router.get("/", async (c) => {
    const invoices = await listIssuedInvoices(pool, getCurrentWorkspaceId());
    return c.json({ invoices });
  });

  router.get("/:id/pdf", async (c) => {
    const invoice = await getIssuedInvoiceById(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
    );
    if (!invoice) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    const pdf = await renderInvoicePdfFromSnapshot(invoice);

    for (const [name, value] of Object.entries(
      invoicePdfHeadersFromSnapshot(invoice),
    )) {
      c.header(name, value);
    }

    return c.body(new Uint8Array(pdf), 200);
  });

  router.post("/preview", async (c) => {
    const body = await parseInvoiceBody(c);
    if (body === "invalid_json") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const preparedOrError = await prepareInvoice(pool, body);
    if ("error" in preparedOrError) {
      return c.json(
        preparedOrError.code
          ? { error: preparedOrError.error, code: preparedOrError.code }
          : { error: preparedOrError.error },
        preparedOrError.status,
      );
    }

    const prepared = withInvoiceOptions(preparedOrError, body);

    const usePrefix = parseUsePrefix(body.usePrefix);
    const prefix = usePrefix ? resolveRequestInvoicePrefix(body, prepared.client) : "";
    if (usePrefix && !isValidInvoicePrefix(prefix)) {
      return c.json({ error: "invoicePrefix must be 1-6 letters or digits" }, 400);
    }

    const suggestedInvoiceNumber = await peekNextInvoiceNumber(
      pool,
      prepared.workspaceId,
      prepared.client,
      prepared.invoiceYear,
      usePrefix ? prefix : undefined,
      usePrefix,
    );

    const invoiceNumber = body.invoiceNumber ?? suggestedInvoiceNumber;
    if (!isValidIssuedInvoiceNumber(invoiceNumber, prepared.invoiceYear)) {
      const messagePrefix = usePrefix
        ? prefix
        : resolveInvoicePrefix(prepared.client);
      return c.json(
        { error: invalidInvoiceNumberMessage(messagePrefix, prepared.invoiceYear) },
        400,
      );
    }

    const numberExists = await invoiceNumberExistsInWorkspace(
      pool,
      prepared.workspaceId,
      invoiceNumber,
    );
    const pdf = await renderInvoicePdf(prepared, invoiceNumber);

    for (const [name, value] of Object.entries(
      invoicePdfHeaders(invoiceNumber, prepared),
    )) {
      c.header(name, value);
    }
    c.header("X-Suggested-Invoice-Number", suggestedInvoiceNumber);
    if (usePrefix) {
      c.header("X-Suggested-Invoice-Prefix", prefix);
    }
    c.header("X-Invoice-Number-Exists", numberExists ? "true" : "false");

    return c.body(new Uint8Array(pdf), 200);
  });

  router.post("/", async (c) => {
    const body = await parseInvoiceBody(c);
    if (body === "invalid_json") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const preparedOrError = await prepareInvoice(pool, body);
    if ("error" in preparedOrError) {
      return c.json(
        preparedOrError.code
          ? { error: preparedOrError.error, code: preparedOrError.code }
          : { error: preparedOrError.error },
        preparedOrError.status,
      );
    }

    const prepared = withInvoiceOptions(preparedOrError, body);

    const client = prepared.client;

    const usePrefix = parseUsePrefix(body.usePrefix);
    const prefix = usePrefix
      ? resolveRequestInvoicePrefix(body, client)
      : resolveInvoicePrefix(client);
    if (!isValidInvoicePrefix(prefix)) {
      return c.json({ error: "invoicePrefix must be 1-6 letters or digits" }, 400);
    }

    const suggestedInvoiceNumber = await peekNextInvoiceNumber(
      pool,
      prepared.workspaceId,
      client,
      prepared.invoiceYear,
      usePrefix ? prefix : undefined,
      usePrefix,
    );
    const invoiceNumber = body.invoiceNumber ?? suggestedInvoiceNumber;

    if (!isValidIssuedInvoiceNumber(invoiceNumber, prepared.invoiceYear)) {
      return c.json(
        { error: invalidInvoiceNumberMessage(prefix, prepared.invoiceYear) },
        400,
      );
    }

    const editedNumber = invoiceNumber !== suggestedInvoiceNumber;
    if (editedNumber && !body.numberingStrategy) {
      return c.json(
        { error: "numberingStrategy is required when overriding Invoice Number" },
        400,
      );
    }
    if (
      body.numberingStrategy &&
      parseNumberingStrategy(body.numberingStrategy) === "invalid"
    ) {
      return c.json({ error: "numberingStrategy must be sequential or from_last" }, 400);
    }

    const created = await createInvoice(pool, {
      workspaceId: prepared.workspaceId,
      clientId: prepared.client.id,
      client,
      invoiceYear: prepared.invoiceYear,
      periodStart: prepared.range.from,
      periodEnd: prepared.range.to,
      invoiceDate: prepared.invoiceDate,
      dueDate: prepared.dueDate,
      totalAmount: prepared.totalAmount,
      totalDurationMinutes: prepared.totalDurationMinutes,
      entryIds: prepared.entryIds,
      snapshot: prepared.snapshot,
      invoiceNumber,
      invoicePrefix: prefix,
      numberingStrategy: editedNumber ? body.numberingStrategy : undefined,
      usePrefix,
    });

    if (created === "duplicate_period") {
      return c.json(
        { error: invoiceConflictMessage("duplicate_period") },
        409,
      );
    }
    if (created === "duplicate_number") {
      return c.json(
        { error: invoiceConflictMessage("duplicate_number") },
        409,
      );
    }
    if (created === "duplicate_month") {
      return c.json(
        { error: invoiceConflictMessage("duplicate_month") },
        409,
      );
    }
    if (created === "invalid_prefix") {
      return c.json(
        { error: "invoicePrefix must be 1-6 letters or digits" },
        400,
      );
    }

    const pdf = await renderInvoicePdf(prepared, created.invoice_number);

    for (const [name, value] of Object.entries(
      invoicePdfHeaders(created.invoice_number, prepared),
    )) {
      c.header(name, value);
    }

    return c.body(new Uint8Array(pdf), 201);
  });

  return router;
}
