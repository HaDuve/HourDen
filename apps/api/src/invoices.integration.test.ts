import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_INVOICE_OPERATOR } from "@hourden/domain/invoice-pdf";
import { normalizeInvoicePdfText } from "@hourden/domain/invoice-pdf-snapshot";
import type { InvoiceIssuanceSnapshot } from "@hourden/domain/invoice-issuance-snapshot";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";

const databaseUrl = process.env.DATABASE_URL;

function expectedInvoiceOperator() {
  return {
    ...DEFAULT_INVOICE_OPERATOR,
    name: process.env.HOURDEN_OPERATOR_NAME ?? DEFAULT_INVOICE_OPERATOR.name,
    email: process.env.HOURDEN_OPERATOR_EMAIL ?? DEFAULT_INVOICE_OPERATOR.email,
  };
}

async function pdfText(body: ArrayBuffer): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(body) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function createClient(
  app: ReturnType<typeof createApp>,
  input: {
    name: string;
    defaultRate?: number;
    legalName?: string;
    addressLine1?: string;
    addressLine2?: string;
  },
) {
  const res = await app.request("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      defaultRate: 60,
      ...input,
    }),
  });
  return res.json() as Promise<{
    id: string;
    name: string;
    legalName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
  }>;
}

async function createProject(
  app: ReturnType<typeof createApp>,
  clientId: string,
  name: string,
) {
  const res = await app.request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, name }),
  });
  return res.json() as Promise<{ id: string }>;
}

describe.skipIf(!databaseUrl)("Invoice API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM invoices");
    await pool.query("DELETE FROM client_invoice_numbering");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("generates an invoice PDF for a Client and Billing Period with grouped totals", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T14:33:00.000Z",
        endedAt: "2026-06-18T15:39:00.000Z",
      }),
    });

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T09:43:00.000Z",
        endedAt: "2026-06-18T09:51:00.000Z",
      }),
    });

    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-18",
        to: "2026-06-30",
      }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toContain("application/pdf");

    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
    expect(Buffer.from(body).subarray(0, 4).toString()).toBe("%PDF");

    const text = await pdfText(body);
    expect(text).toContain("Rechnung / Invoice");
    expect(text).toContain("BANDAO Guidance GmbH");
    expect(text).toContain("Schloßbergstraße 1");
    expect(text).toContain("82319 Starnberg");
    expect(text).toContain("74.00 EUR");
    expect(text).toContain("Gemäß § 19 UStG");
    expect(text).toContain("DE74 120300001060924758");
  });

  it("assigns sequential Invoice Numbers per Client per calendar year", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    const createEntry = (from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ondojo.id,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry("2026-05-01", "2026-05-01");
    await createEntry("2026-06-01", "2026-06-01");

    const may = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-05-01",
        to: "2026-05-31",
      }),
    });
    const june = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(may.headers.get("x-invoice-number")).toBe("2026001");
    expect(june.headers.get("x-invoice-number")).toBe("2026002");
  });

  it("prevents duplicate Invoices for the same Client and Billing Period", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    const first = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    const second = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: "Invoice already exists for this Client and Billing Period",
    });
  });

  it("prevents a second Invoice for the same Client and billing month", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Early June work",
        startedAt: "2026-06-10T10:00:00.000Z",
        endedAt: "2026-06-10T11:00:00.000Z",
      }),
    });
    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Late June work",
        startedAt: "2026-06-20T10:00:00.000Z",
        endedAt: "2026-06-20T11:00:00.000Z",
      }),
    });

    const first = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-15",
      }),
    });
    const second = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-16",
        to: "2026-06-30",
      }),
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: "Invoice already exists for this Client and billing month",
    });
  });

  it("marks covered Time Entries as Invoiced and blocks edits", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    const created = await (
      await app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ondojo.id,
          description: "Billable work",
          startedAt: "2026-06-18T10:00:00.000Z",
          endedAt: "2026-06-18T11:00:00.000Z",
        }),
      })
    ).json();

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    const listed = await (
      await app.request("/api/time-entries?date=2026-06-18")
    ).json();
    expect(listed.entries[0].invoiced).toBe(true);

    const patch = await app.request(`/api/time-entries/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Changed" }),
    });
    expect(patch.status).toBe(409);
    expect(await patch.json()).toEqual({
      error: "Invoiced Time Entry is read-only",
    });
  });

  it("uses the same grouped totals as the Report for the Billing Period", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T14:33:00.000Z",
        endedAt: "2026-06-18T15:39:00.000Z",
      }),
    });
    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T09:43:00.000Z",
        endedAt: "2026-06-18T09:51:00.000Z",
      }),
    });

    const report = await (
      await app.request("/api/reports?from=2026-06-18&to=2026-06-30")
    ).json();
    const invoice = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-18",
        to: "2026-06-30",
      }),
    });

    const text = await pdfText(await invoice.arrayBuffer());
    const clientReport = report.clients.find(
      (client: { clientName: string }) => client.clientName === "Bandao",
    );

    expect(clientReport.totalAmount).toBe(74);
    expect(clientReport.totalDurationMinutes).toBe(74);
    expect(text).toContain("74.00 EUR");
    expect(text).toContain("74");
  });

  it("stores a verbatim issuance snapshot when issuing an Invoice", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T14:33:00.000Z",
        endedAt: "2026-06-18T15:39:00.000Z",
      }),
    });

    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-18",
        to: "2026-06-30",
      }),
    });

    expect(res.status).toBe(201);

    const row = await pool.query<{
      snapshot: InvoiceIssuanceSnapshot;
      status: string;
    }>("SELECT snapshot, status FROM invoices LIMIT 1");

    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]!.status).toBe("issued");
    expect(row.rows[0]!.snapshot).toEqual({
      recipient: {
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
      },
      operator: expectedInvoiceOperator(),
      lines: [
        {
          date: "2026-06-18",
          description: "App Development",
          durationMinutes: 66,
          amount: 66,
        },
      ],
      totals: {
        totalAmount: 66,
        totalDurationMinutes: 66,
      },
    });
  });

  it("preview renders a PDF with the next Invoice Number without committing", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    const preview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(preview.status).toBe(200);
    expect(preview.headers.get("content-type")).toContain("application/pdf");
    expect(preview.headers.get("x-invoice-number")).toBe("2026001");

    const invoices = await pool.query("SELECT id, snapshot FROM invoices");
    expect(invoices.rows).toHaveLength(0);

    const listed = await (
      await app.request("/api/time-entries?date=2026-06-18")
    ).json();
    expect(listed.entries[0].invoiced).toBe(false);

    const previewAgain = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    expect(previewAgain.headers.get("x-invoice-number")).toBe("2026001");
  });

  it("preview and issue render identical PDF content for the same inputs", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T14:33:00.000Z",
        endedAt: "2026-06-18T15:39:00.000Z",
      }),
    });
    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T09:43:00.000Z",
        endedAt: "2026-06-18T09:51:00.000Z",
      }),
    });

    const requestBody = {
      clientId: bandao.id,
      from: "2026-06-18",
      to: "2026-06-30",
    };

    const preview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const issued = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    expect(preview.headers.get("x-invoice-number")).toBe("2026001");
    expect(issued.headers.get("x-invoice-number")).toBe("2026001");

    const previewText = normalizeInvoicePdfText(await pdfText(await preview.arrayBuffer()), {
      invoiceNumber: "2026001",
      legalName: "BANDAO Guidance GmbH",
    });
    const issuedText = normalizeInvoicePdfText(await pdfText(await issued.arrayBuffer()), {
      invoiceNumber: "2026001",
      legalName: "BANDAO Guidance GmbH",
    });

    expect(issuedText).toBe(previewText);
  });

  it("reconstructs an issued Invoice PDF from its snapshot after Client Recipient fields change", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T14:33:00.000Z",
        endedAt: "2026-06-18T15:39:00.000Z",
      }),
    });

    const issued = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-18",
        to: "2026-06-30",
      }),
    });

    expect(issued.status).toBe(201);
    const invoiceNumber = issued.headers.get("x-invoice-number")!;
    const originalText = normalizeInvoicePdfText(await pdfText(await issued.arrayBuffer()), {
      invoiceNumber,
      legalName: "BANDAO Guidance GmbH",
    });

    const row = await pool.query<{ id: string }>("SELECT id FROM invoices LIMIT 1");
    const invoiceId = row.rows[0]!.id;

    const patched = await app.request(`/api/clients/${bandao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: "Mutated Legal Name GmbH",
        addressLine1: "New Street 99",
        addressLine2: "99999 Elsewhere",
      }),
    });
    expect(patched.status).toBe(200);

    const reconstructed = await app.request(`/api/invoices/${invoiceId}/pdf`);
    expect(reconstructed.status).toBe(200);
    expect(reconstructed.headers.get("content-type")).toContain("application/pdf");

    const reconstructedBody = await reconstructed.arrayBuffer();
    const reconstructedText = normalizeInvoicePdfText(await pdfText(reconstructedBody), {
      invoiceNumber,
      legalName: "BANDAO Guidance GmbH",
    });

    expect(reconstructedText).toBe(originalText);

    const rawReconstructedText = await pdfText(reconstructedBody);
    expect(rawReconstructedText).toContain("BANDAO Guidance GmbH");
    expect(rawReconstructedText).not.toContain("Mutated Legal Name GmbH");
  });

  it("reconstructs an issued Invoice PDF from its snapshot after Operator env changes", async () => {
    const originalOperatorName = process.env.HOURDEN_OPERATOR_NAME;
    const operatorName = originalOperatorName ?? DEFAULT_INVOICE_OPERATOR.name;

    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    const issued = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(issued.status).toBe(201);
    const invoiceNumber = issued.headers.get("x-invoice-number")!;
    const originalText = normalizeInvoicePdfText(await pdfText(await issued.arrayBuffer()), {
      invoiceNumber,
      legalName: "BANDAO Guidance GmbH",
    });

    const row = await pool.query<{ id: string }>("SELECT id FROM invoices LIMIT 1");
    const invoiceId = row.rows[0]!.id;

    try {
      process.env.HOURDEN_OPERATOR_NAME = "Mutated Operator Name";

      const reconstructed = await app.request(`/api/invoices/${invoiceId}/pdf`);
      expect(reconstructed.status).toBe(200);

      const reconstructedBody = await reconstructed.arrayBuffer();
      const reconstructedText = normalizeInvoicePdfText(await pdfText(reconstructedBody), {
        invoiceNumber,
        legalName: "BANDAO Guidance GmbH",
      });

      expect(reconstructedText).toBe(originalText);

      const rawReconstructedText = await pdfText(reconstructedBody);
      expect(rawReconstructedText).toContain(operatorName);
      expect(rawReconstructedText).not.toContain("Mutated Operator Name");
    } finally {
      if (originalOperatorName === undefined) {
        delete process.env.HOURDEN_OPERATOR_NAME;
      } else {
        process.env.HOURDEN_OPERATOR_NAME = originalOperatorName;
      }
    }
  });

  it("lists issued Invoices with Recipient, Invoice Number, Billing Period, and total", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    const res = await app.request("/api/invoices");
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      invoices: Array<{
        id: string;
        recipient: string;
        invoiceNumber: string;
        periodStart: string;
        periodEnd: string;
        totalAmount: number;
      }>;
    };

    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0]).toMatchObject({
      recipient: "BANDAO Guidance GmbH",
      invoiceNumber: "2026001",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      totalAmount: 60,
    });
    expect(data.invoices[0]!.id).toBeTruthy();
  });

  it("excludes non-issued Invoices from the list and PDF reconstruction", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    const row = await pool.query<{ id: string }>("SELECT id FROM invoices LIMIT 1");
    const invoiceId = row.rows[0]!.id;

    await pool.query("UPDATE invoices SET status = 'voided' WHERE id = $1", [
      invoiceId,
    ]);

    const list = await app.request("/api/invoices");
    expect((await list.json()).invoices).toHaveLength(0);

    const pdf = await app.request(`/api/invoices/${invoiceId}/pdf`);
    expect(pdf.status).toBe(404);
  });

  it("exports issued invoices as Outgoing.zip with recipient/year tree layout", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    const res = await app.request("/api/invoices/export.zip");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/zip");
    expect(res.headers.get("content-disposition")).toContain('filename="Outgoing.zip"');

    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const paths = Object.keys(zip.files).filter((path) => !zip.files[path]!.dir);
    expect(paths).toEqual([
      "BANDAO/2026/2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
    ]);

    const pdf = await zip.file(paths[0]!)!.async("nodebuffer");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");

    const text = await pdfText(
      pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer,
    );
    expect(text).toContain("BANDAO Guidance GmbH");
  });

  it("filters export.zip by client and year query parameters", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const acme = await createClient(app, {
      name: "Acme Corp",
      legalName: "Acme Corporation",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const acmeProject = await createProject(app, acme.id, "Website");

    const createEntry = (
      projectId: string,
      startedAt: string,
      endedAt: string,
    ) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Billable work",
          startedAt,
          endedAt,
        }),
      });

    await createEntry(
      bandaoProject.id,
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T11:00:00.000Z",
    );
    await createEntry(
      bandaoProject.id,
      "2026-06-01T10:00:00.000Z",
      "2026-06-01T11:00:00.000Z",
    );
    await createEntry(
      acmeProject.id,
      "2026-06-01T10:00:00.000Z",
      "2026-06-01T11:00:00.000Z",
    );

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-05-01",
        to: "2026-05-31",
      }),
    });
    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: acme.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    const clientFiltered = await app.request(
      `/api/invoices/export.zip?client=${bandao.id}`,
    );
    const clientZip = await JSZip.loadAsync(await clientFiltered.arrayBuffer());
    const clientPaths = Object.keys(clientZip.files).filter(
      (path) => !clientZip.files[path]!.dir,
    );
    expect(clientPaths).toEqual([
      "BANDAO/2026/2026001_31_05_26_Invoice_Hannes_Duve_BANDAO.pdf",
      "BANDAO/2026/2026002_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
    ]);

    const yearFiltered = await app.request("/api/invoices/export.zip?year=2026");
    const yearZip = await JSZip.loadAsync(await yearFiltered.arrayBuffer());
    const yearPaths = Object.keys(yearZip.files).filter(
      (path) => !yearZip.files[path]!.dir,
    );
    expect(yearPaths).toHaveLength(3);
    expect(yearPaths).toContain(
      "ACMECORP/2026/2026001_30_06_26_Invoice_Hannes_Duve_ACMECORP.pdf",
    );

    const bothFiltered = await app.request(
      `/api/invoices/export.zip?client=${acme.id}&year=2026`,
    );
    const bothZip = await JSZip.loadAsync(await bothFiltered.arrayBuffer());
    const bothPaths = Object.keys(bothZip.files).filter(
      (path) => !bothZip.files[path]!.dir,
    );
    expect(bothPaths).toEqual([
      "ACMECORP/2026/2026001_30_06_26_Invoice_Hannes_Duve_ACMECORP.pdf",
    ]);
  });

  it("rejects invalid export.zip query filters with 400", async () => {
    const invalidYear = await app.request("/api/invoices/export.zip?year=abc");
    expect(invalidYear.status).toBe(400);
    expect(await invalidYear.json()).toEqual({
      error: "year must be a four-digit calendar year",
    });

    const invalidClient = await app.request(
      "/api/invoices/export.zip?client=not-a-uuid",
    );
    expect(invalidClient.status).toBe(400);
    expect(await invalidClient.json()).toEqual({
      error: "client must be a valid client id",
    });
  });

  it("excludes voided and missing-snapshot invoices from export.zip", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    const issuedExport = await app.request("/api/invoices/export.zip");
    const issuedZip = await JSZip.loadAsync(await issuedExport.arrayBuffer());
    expect(
      Object.keys(issuedZip.files).filter((path) => !issuedZip.files[path]!.dir),
    ).toHaveLength(1);

    const row = await pool.query<{ id: string }>("SELECT id FROM invoices LIMIT 1");
    const invoiceId = row.rows[0]!.id;

    await pool.query("UPDATE invoices SET status = 'voided' WHERE id = $1", [
      invoiceId,
    ]);

    const voidedExport = await app.request("/api/invoices/export.zip");
    const voidedZip = await JSZip.loadAsync(await voidedExport.arrayBuffer());
    expect(
      Object.keys(voidedZip.files).filter((path) => !voidedZip.files[path]!.dir),
    ).toHaveLength(0);

    await pool.query(
      "UPDATE invoices SET status = 'issued', snapshot = NULL WHERE id = $1",
      [invoiceId],
    );

    const missingSnapshotExport = await app.request("/api/invoices/export.zip");
    const missingSnapshotZip = await JSZip.loadAsync(
      await missingSnapshotExport.arrayBuffer(),
    );
    expect(
      Object.keys(missingSnapshotZip.files).filter(
        (path) => !missingSnapshotZip.files[path]!.dir,
      ),
    ).toHaveLength(0);
  });

  it("excludes Invoices with a missing snapshot from the list and PDF reconstruction", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    const row = await pool.query<{ id: string }>("SELECT id FROM invoices LIMIT 1");
    const invoiceId = row.rows[0]!.id;

    await pool.query("UPDATE invoices SET snapshot = NULL WHERE id = $1", [invoiceId]);

    const list = await app.request("/api/invoices");
    expect((await list.json()).invoices).toHaveLength(0);

    const pdf = await app.request(`/api/invoices/${invoiceId}/pdf`);
    expect(pdf.status).toBe(404);
  });

  it("preview accepts a custom Invoice Number and reports whether it already exists", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    const preview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        invoiceNumber: "2026010",
      }),
    });

    expect(preview.status).toBe(200);
    expect(preview.headers.get("x-invoice-number")).toBe("2026010");
    expect(preview.headers.get("x-suggested-invoice-number")).toBe("2026001");
    expect(preview.headers.get("x-invoice-number-exists")).toBe("false");

    const text = await pdfText(await preview.arrayBuffer());
    expect(text).toContain("2026010");

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        invoiceNumber: "2026010",
        numberingStrategy: "from_last",
      }),
    });

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "More work",
        startedAt: "2026-07-18T10:00:00.000Z",
        endedAt: "2026-07-18T11:00:00.000Z",
      }),
    });

    const duplicatePreview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-07-01",
        to: "2026-07-31",
        invoiceNumber: "2026010",
      }),
    });

    expect(duplicatePreview.headers.get("x-invoice-number-exists")).toBe("true");
  });

  it("issues with an edited Invoice Number and persists the chosen numbering strategy", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    const createEntry = (from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ondojo.id,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry("2026-05-01", "2026-05-01");
    await createEntry("2026-06-01", "2026-06-01");
    await createEntry("2026-07-01", "2026-07-01");

    const may = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-05-01",
        to: "2026-05-31",
        invoiceNumber: "2026010",
        numberingStrategy: "sequential",
      }),
    });
    expect(may.status).toBe(201);
    expect(may.headers.get("x-invoice-number")).toBe("2026010");

    const june = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    expect(june.headers.get("x-invoice-number")).toBe("2026002");

    await createEntry("2026-08-01", "2026-08-01");

    const august = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-08-01",
        to: "2026-08-31",
        invoiceNumber: "2026020",
        numberingStrategy: "from_last",
      }),
    });
    expect(august.headers.get("x-invoice-number")).toBe("2026020");

    await createEntry("2026-09-01", "2026-09-01");

    const september = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-09-01",
        to: "2026-09-30",
      }),
    });
    expect(september.headers.get("x-invoice-number")).toBe("2026021");
  });

  it("returns numbering previews for an edited Invoice Number", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });

    const res = await app.request(
      `/api/invoices/numbering-preview?clientId=${bandao.id}&invoiceNumber=2026010&year=2026`,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      exists: false,
      suggestedNumber: "2026001",
      nextIfIssued: {
        sequential: "2026002",
        fromLast: "2026011",
      },
    });
  });
});
