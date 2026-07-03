import {
  DEFAULT_INVOICE_OPERATOR,
  generateInvoicePdf,
  type InvoiceOperator,
} from "@hourden/domain/invoice-pdf";
import type { InvoiceIssuanceSnapshot } from "@hourden/domain/invoice-issuance-snapshot";
import type { GroupedReportLine } from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  createInvoice,
  findInvoiceForBillingMonth,
  findInvoiceForPeriod,
  getClientForInvoice,
  getIssuedInvoiceById,
  listInvoiceableEntriesForClient,
  listIssuedInvoices,
  peekNextInvoiceNumber,
  rowsToGroupedInvoiceLines,
  type IssuedInvoiceDetail,
} from "./db/invoices.js";
import { reportTimeZone } from "./db/reports.js";
import { getCurrentWorkspaceId } from "./workspace.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type InvoiceRequestBody = { clientId?: string; from?: string; to?: string };

type InvoiceClient = {
  id: string;
  name: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
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

type PrepareInvoiceError = { error: string; status: 400 | 404 | 409 };

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

function invoiceRecipientCode(clientName: string): string {
  return clientName.trim().toUpperCase().replace(/\s+/g, "");
}

function invoiceFilename(
  invoiceNumber: string,
  periodEnd: string,
  recipientCode: string,
): string {
  const [year, month, day] = periodEnd.split("-");
  const datePart = `${day}_${month}_${year.slice(2)}`;
  return `${invoiceNumber}_${datePart}_Invoice_Hannes_Duve_${recipientCode}.pdf`;
}

function invoiceOperator(): InvoiceOperator {
  return {
    ...DEFAULT_INVOICE_OPERATOR,
    name: process.env.HOURDEN_OPERATOR_NAME ?? DEFAULT_INVOICE_OPERATOR.name,
    email: process.env.HOURDEN_OPERATOR_EMAIL ?? DEFAULT_INVOICE_OPERATOR.email,
  };
}

function invoiceConflictMessage(
  reason: "duplicate_period" | "duplicate_month" | "duplicate_number",
): string {
  if (reason === "duplicate_month") {
    return "Invoice already exists for this Client and billing month";
  }
  return "Invoice already exists for this Client and Billing Period";
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

  const timeZone = reportTimeZone();
  const entryRows = await listInvoiceableEntriesForClient(
    pool,
    workspaceId,
    client.id,
    range.from,
    range.to,
    timeZone,
  );

  if (entryRows.length === 0) {
    return {
      error: "No billable Time Entries in this Billing Period",
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
  const operator = invoiceOperator();

  return {
    workspaceId,
    client: {
      id: client.id,
      name: client.name,
      legalName: client.legalName,
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2,
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
    lines: prepared.lines,
    operator: prepared.operator,
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

export function createInvoicesRouter(pool: Pool) {
  const router = new Hono();

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

    const prepared = await prepareInvoice(pool, body);
    if ("error" in prepared) {
      return c.json({ error: prepared.error }, prepared.status);
    }

    const invoiceNumber = await peekNextInvoiceNumber(
      pool,
      prepared.client.id,
      prepared.invoiceYear,
    );
    const pdf = await renderInvoicePdf(prepared, invoiceNumber);

    for (const [name, value] of Object.entries(
      invoicePdfHeaders(invoiceNumber, prepared),
    )) {
      c.header(name, value);
    }

    return c.body(new Uint8Array(pdf), 200);
  });

  router.post("/", async (c) => {
    const body = await parseInvoiceBody(c);
    if (body === "invalid_json") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const prepared = await prepareInvoice(pool, body);
    if ("error" in prepared) {
      return c.json({ error: prepared.error }, prepared.status);
    }

    const created = await createInvoice(pool, {
      workspaceId: prepared.workspaceId,
      clientId: prepared.client.id,
      invoiceYear: prepared.invoiceYear,
      periodStart: prepared.range.from,
      periodEnd: prepared.range.to,
      invoiceDate: prepared.invoiceDate,
      dueDate: prepared.dueDate,
      totalAmount: prepared.totalAmount,
      totalDurationMinutes: prepared.totalDurationMinutes,
      entryIds: prepared.entryIds,
      snapshot: prepared.snapshot,
    });

    if (created === "duplicate_period" || created === "duplicate_number") {
      return c.json(
        { error: invoiceConflictMessage("duplicate_period") },
        409,
      );
    }
    if (created === "duplicate_month") {
      return c.json(
        { error: invoiceConflictMessage("duplicate_month") },
        409,
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
