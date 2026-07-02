import {
  DEFAULT_INVOICE_OPERATOR,
  generateInvoicePdf,
} from "@hourden/domain/invoice-pdf";
import { nextInvoiceNumber } from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  createInvoice,
  findInvoiceForPeriod,
  getClientForInvoice,
  listInvoiceableEntriesForClient,
  listInvoiceNumbersForClientYear,
  rowsToGroupedInvoiceLines,
} from "./db/invoices.js";
import { reportTimeZone } from "./db/reports.js";
import { getCurrentWorkspaceId } from "./workspace.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function invoiceOperator() {
  return {
    ...DEFAULT_INVOICE_OPERATOR,
    name: process.env.HOURDEN_OPERATOR_NAME ?? DEFAULT_INVOICE_OPERATOR.name,
    email: process.env.HOURDEN_OPERATOR_EMAIL ?? DEFAULT_INVOICE_OPERATOR.email,
  };
}

export function createInvoicesRouter(pool: Pool) {
  const router = new Hono();

  router.post("/", async (c) => {
    let body: { clientId?: string; from?: string; to?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const range = parseDateRange(body.from, body.to);
    if (range === "invalid") {
      return c.json(
        {
          error:
            "from and to are required (YYYY-MM-DD) with from <= to",
        },
        400,
      );
    }

    if (!body.clientId) {
      return c.json({ error: "clientId is required" }, 400);
    }

    const workspaceId = getCurrentWorkspaceId();
    const client = await getClientForInvoice(pool, workspaceId, body.clientId);
    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    if (!client.legalName || !client.addressLine1 || !client.addressLine2) {
      return c.json(
        { error: "Client Recipient fields are required before invoicing" },
        400,
      );
    }

    const existing = await findInvoiceForPeriod(
      pool,
      client.id,
      range.from,
      range.to,
    );
    if (existing) {
      return c.json(
        { error: "Invoice already exists for this Client and Billing Period" },
        409,
      );
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
      return c.json(
        { error: "No billable Time Entries in this Billing Period" },
        400,
      );
    }

    const lines = rowsToGroupedInvoiceLines(entryRows, timeZone);
    const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
    const totalDurationMinutes = lines.reduce(
      (sum, line) => sum + line.durationMinutes,
      0,
    );

    const invoiceYear = Number(range.to.slice(0, 4));
    const existingNumbers = await listInvoiceNumbersForClientYear(
      pool,
      client.id,
      invoiceYear,
    );
    const invoiceNumber = nextInvoiceNumber(existingNumbers, invoiceYear);
    const invoiceDate = range.to;
    const dueDate = addDays(invoiceDate, 14);

    const pdf = await generateInvoicePdf({
      invoiceNumber,
      invoiceDate,
      periodStart: range.from,
      periodEnd: range.to,
      dueDate,
      recipient: {
        legalName: client.legalName,
        addressLine1: client.addressLine1,
        addressLine2: client.addressLine2,
      },
      lines,
      operator: invoiceOperator(),
    });

    await createInvoice(pool, {
      workspaceId,
      clientId: client.id,
      invoiceNumber,
      periodStart: range.from,
      periodEnd: range.to,
      invoiceDate,
      dueDate,
      totalAmount,
      totalDurationMinutes,
      entryIds: entryRows.map((row) => row.id),
    });

    const recipientCode = invoiceRecipientCode(client.name);
    const filename = invoiceFilename(invoiceNumber, range.to, recipientCode);

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    c.header("X-Invoice-Number", invoiceNumber);
    return c.body(new Uint8Array(pdf), 201);
  });

  return router;
}
