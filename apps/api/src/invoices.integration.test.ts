import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { DEFAULT_INVOICE_OPERATOR } from "@hourden/domain/invoice-pdf";
import { normalizeInvoicePdfText } from "@hourden/domain/invoice-pdf-snapshot";
import type { InvoiceIssuanceSnapshot } from "@hourden/domain/invoice-issuance-snapshot";
import { createApp } from "./app.js";
import { workspaceRowToInvoiceOperator } from "./db/workspaces.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { bindSessionAuth } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

async function expectedInvoiceOperator(pool: Pool) {
  const row = await pool.query<{
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
  }>(
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
    [DEFAULT_WORKSPACE_ID],
  );
  return workspaceRowToInvoiceOperator(row.rows[0] ?? null);
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
    await runMigrationsForTests(pool);
    await bindSessionAuth(app);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM invoices");
    await pool.query("DELETE FROM workspace_invoice_numbering");
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

  it("rejects issue when Invoice Number is overridden without numberingStrategy", async () => {
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
      operator: await expectedInvoiceOperator(pool),
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

  it("captures Workspace Invoice Sender in issuance snapshot, not process env", async () => {
    const originalOperatorName = process.env.HOURDEN_OPERATOR_NAME;
    process.env.HOURDEN_OPERATOR_NAME = "Env Operator Name";

    const workspaceBefore = await pool.query<{ sender_name: string | null }>(
      "SELECT sender_name FROM workspaces WHERE id = $1",
      [DEFAULT_WORKSPACE_ID],
    );
    const previousSenderName = workspaceBefore.rows[0]!.sender_name;

    try {
      await pool.query(
        "UPDATE workspaces SET sender_name = $2 WHERE id = $1",
        [DEFAULT_WORKSPACE_ID, "Workspace Sender Name"],
      );

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

      const res = await app.request("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: bandao.id,
          from: "2026-06-01",
          to: "2026-06-30",
        }),
      });

      expect(res.status).toBe(201);

      const row = await pool.query<{ snapshot: InvoiceIssuanceSnapshot }>(
        "SELECT snapshot FROM invoices LIMIT 1",
      );

      expect(row.rows[0]!.snapshot.operator.name).toBe("Workspace Sender Name");
      expect(row.rows[0]!.snapshot.operator.name).not.toBe("Env Operator Name");
    } finally {
      await pool.query(
        "UPDATE workspaces SET sender_name = $2 WHERE id = $1",
        [DEFAULT_WORKSPACE_ID, previousSenderName],
      );
      if (originalOperatorName === undefined) {
        delete process.env.HOURDEN_OPERATOR_NAME;
      } else {
        process.env.HOURDEN_OPERATOR_NAME = originalOperatorName;
      }
    }
  });

  it("returns ENTRIES_MISSING_DESCRIPTION when stopped Client time in the period has no Description", async () => {
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

    expect(preview.status).toBe(400);
    expect(await preview.json()).toEqual({
      error: "Time Entries in this Billing Period need a Description before invoicing",
      code: "ENTRIES_MISSING_DESCRIPTION",
    });
  });

  it("returns NO_BILLABLE_ENTRIES when there is no invoiceable time for the Client in the period", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
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

    expect(preview.status).toBe(400);
    expect(await preview.json()).toEqual({
      error: "No billable Time Entries in this Billing Period",
      code: "NO_BILLABLE_ENTRIES",
    });
  });

  it("returns ENTRIES_WITHOUT_PROJECT when stopped time in the period has no Project", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Unassigned work",
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

    expect(preview.status).toBe(400);
    expect(await preview.json()).toEqual({
      error: "Time Entries in this Billing Period are not assigned to a Project",
      code: "ENTRIES_WITHOUT_PROJECT",
    });
  });

  it("returns ENTRIES_WITHOUT_PROJECT when both orphan time and missing-description Client time exist", async () => {
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
        startedAt: "2026-06-18T09:00:00.000Z",
        endedAt: "2026-06-18T10:00:00.000Z",
      }),
    });

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Unassigned work",
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

    expect(preview.status).toBe(400);
    expect(await preview.json()).toEqual({
      error: "Time Entries in this Billing Period are not assigned to a Project",
      code: "ENTRIES_WITHOUT_PROJECT",
    });
  });

  it("returns MISSING_RECIPIENT when previewing a Client without Recipient fields", async () => {
    const hannah = await createClient(app, { name: "Hannah", defaultRate: 80 });

    const preview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(preview.status).toBe(400);
    expect(await preview.json()).toEqual({
      error: "Client Recipient fields are required before invoicing",
      code: "MISSING_RECIPIENT",
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
    expect(preview.headers.get("x-invoice-number")).toBe("BAN2026001");

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
    expect(previewAgain.headers.get("x-invoice-number")).toBe("BAN2026001");
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

    expect(preview.headers.get("x-invoice-number")).toBe("BAN2026001");
    expect(issued.headers.get("x-invoice-number")).toBe("BAN2026001");

    const previewText = normalizeInvoicePdfText(await pdfText(await preview.arrayBuffer()), {
      invoiceNumber: "BAN2026001",
      legalName: "BANDAO Guidance GmbH",
    });
    const issuedText = normalizeInvoicePdfText(await pdfText(await issued.arrayBuffer()), {
      invoiceNumber: "BAN2026001",
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

  it("reconstructs an issued Invoice PDF from its snapshot after Workspace sender changes", async () => {
    const workspaceBefore = await pool.query<{ sender_name: string | null }>(
      "SELECT sender_name FROM workspaces WHERE id = $1",
      [DEFAULT_WORKSPACE_ID],
    );
    const previousSenderName = workspaceBefore.rows[0]!.sender_name;
    const operatorName = previousSenderName ?? DEFAULT_INVOICE_OPERATOR.name;

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
      await pool.query(
        "UPDATE workspaces SET sender_name = $2 WHERE id = $1",
        [DEFAULT_WORKSPACE_ID, "Mutated Operator Name"],
      );

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
      await pool.query(
        "UPDATE workspaces SET sender_name = $2 WHERE id = $1",
        [DEFAULT_WORKSPACE_ID, previousSenderName],
      );
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
      invoiceNumber: "BAN2026001",
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
      "BANDAO/2026/BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
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
      "BANDAO/2026/BAN2026001_31_05_26_Invoice_Hannes_Duve_BANDAO.pdf",
      "BANDAO/2026/BAN2026002_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
    ]);

    const yearFiltered = await app.request("/api/invoices/export.zip?year=2026");
    const yearZip = await JSZip.loadAsync(await yearFiltered.arrayBuffer());
    const yearPaths = Object.keys(yearZip.files).filter(
      (path) => !yearZip.files[path]!.dir,
    );
    expect(yearPaths).toHaveLength(3);
    expect(yearPaths).toContain(
      "ACMECORP/2026/ACM2026001_30_06_26_Invoice_Hannes_Duve_ACMECORP.pdf",
    );

    const bothFiltered = await app.request(
      `/api/invoices/export.zip?client=${acme.id}&year=2026`,
    );
    const bothZip = await JSZip.loadAsync(await bothFiltered.arrayBuffer());
    const bothPaths = Object.keys(bothZip.files).filter(
      (path) => !bothZip.files[path]!.dir,
    );
    expect(bothPaths).toEqual([
      "ACMECORP/2026/ACM2026001_30_06_26_Invoice_Hannes_Duve_ACMECORP.pdf",
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
    expect(preview.headers.get("x-suggested-invoice-number")).toBe("BAN2026001");
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
    expect(june.headers.get("x-invoice-number")).toBe("BAN2026002");

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
    expect(september.headers.get("x-invoice-number")).toBe("BAN2026003");
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
      suggestedNumber: "BAN2026001",
      nextIfIssued: {
        sequential: "BAN2026002",
        fromLast: "BAN2026001",
      },
    });
  });

  it("rejects issue when Invoice Number is overridden without numberingStrategy", async () => {
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

    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        invoiceNumber: "2026010",
      }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "numberingStrategy is required when overriding Invoice Number",
    });
  });

  it("rejects preview when the Client name yields no valid Invoice Prefix", async () => {
    const numeric = await createClient(app, {
      name: "123",
      legalName: "Numeric Corp",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const project = await createProject(app, numeric.id, "Work");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    const preview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: numeric.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(preview.status).toBe(400);
    expect(await preview.json()).toEqual({
      error: "invoicePrefix must be 1-6 letters or digits",
    });
  });

  it("suggests prefixed Invoice Numbers per Client (Bandao BAN, Hannah HAN)", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const hannahProject = await createProject(app, hannah.id, "Coaching");

    const createEntry = (projectId: string, from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry(bandaoProject.id, "2026-06-01", "2026-06-01");
    await createEntry(hannahProject.id, "2026-06-01", "2026-06-01");

    const bandaoInvoice = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    const hannahInvoice = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(bandaoInvoice.headers.get("x-invoice-number")).toBe("BAN2026001");
    expect(hannahInvoice.headers.get("x-invoice-number")).toBe("HAN2026001");
  });

  it("rejects workspace-wide duplicate Invoice Numbers across Clients", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const hannahProject = await createProject(app, hannah.id, "Coaching");

    const createEntry = (projectId: string, from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry(bandaoProject.id, "2026-06-01", "2026-06-01");
    await createEntry(hannahProject.id, "2026-07-01", "2026-07-01");

    const bandaoIssued = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    expect(bandaoIssued.status).toBe(201);
    expect(bandaoIssued.headers.get("x-invoice-number")).toBe("BAN2026001");

    const hannahDuplicate = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        invoiceNumber: "BAN2026001",
        numberingStrategy: "sequential",
      }),
    });

    expect(hannahDuplicate.status).toBe(409);
    expect(await hannahDuplicate.json()).toEqual({
      error: "Invoice Number already exists in this Workspace",
    });
  });

  it("increments the per-Client prefixed counter across multiple invoices", async () => {
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

    expect(may.headers.get("x-invoice-number")).toBe("BAN2026001");
    expect(june.headers.get("x-invoice-number")).toBe("BAN2026002");
  });

  it("uses the workspace-global plain pool when usePrefix is false", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const hannahProject = await createProject(app, hannah.id, "Coaching");

    const createEntry = (projectId: string, from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry(bandaoProject.id, "2026-06-01", "2026-06-01");
    await createEntry(hannahProject.id, "2026-06-01", "2026-06-01");

    const bandaoPrefixed = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    const hannahPrefixed = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(bandaoPrefixed.headers.get("x-invoice-number")).toBe("BAN2026001");
    expect(hannahPrefixed.headers.get("x-invoice-number")).toBe("HAN2026001");

    await createEntry(bandaoProject.id, "2026-07-01", "2026-07-01");

    const bandaoPlainPreview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(bandaoPlainPreview.status).toBe(200);
    expect(bandaoPlainPreview.headers.get("x-suggested-invoice-number")).toBe(
      "2026001",
    );

    const bandaoPlain = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(bandaoPlain.status).toBe(201);
    expect(bandaoPlain.headers.get("x-invoice-number")).toBe("2026001");

    const bandaoClient = await (
      await app.request(`/api/clients/${bandao.id}`)
    ).json();
    expect(bandaoClient.invoicePrefix).toBe("BAN");

    await createEntry(hannahProject.id, "2026-07-01", "2026-07-01");

    const hannahPlainPreview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(hannahPlainPreview.headers.get("x-suggested-invoice-number")).toBe(
      "2026002",
    );

    const hannahPlain = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(hannahPlain.headers.get("x-invoice-number")).toBe("2026002");

    await createEntry(hannahProject.id, "2026-08-01", "2026-08-01");

    const hannahPrefixedPreview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-08-01",
        to: "2026-08-31",
      }),
    });
    expect(hannahPrefixedPreview.headers.get("x-suggested-invoice-number")).toBe(
      "HAN2026003",
    );
  });

  it("rejects workspace-wide duplicate plain Invoice Numbers across Clients", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const hannahProject = await createProject(app, hannah.id, "Coaching");

    const createEntry = (projectId: string, from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry(bandaoProject.id, "2026-06-01", "2026-06-01");
    await createEntry(hannahProject.id, "2026-07-01", "2026-07-01");

    const bandaoPlain = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        usePrefix: false,
      }),
    });
    expect(bandaoPlain.status).toBe(201);
    expect(bandaoPlain.headers.get("x-invoice-number")).toBe("2026001");

    const hannahDuplicate = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
        invoiceNumber: "2026001",
        numberingStrategy: "sequential",
      }),
    });

    expect(hannahDuplicate.status).toBe(409);
    expect(await hannahDuplicate.json()).toEqual({
      error: "Invoice Number already exists in this Workspace",
    });
  });

  it("returns plain numbering previews when usePrefix is false", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: bandaoProject.id,
        description: "Work",
        startedAt: "2026-06-01T10:00:00.000Z",
        endedAt: "2026-06-01T11:00:00.000Z",
      }),
    });

    await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        usePrefix: false,
      }),
    });

    const res = await app.request(
      `/api/invoices/numbering-preview?clientId=${hannah.id}&invoiceNumber=2026010&year=2026&usePrefix=false`,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      exists: false,
      suggestedNumber: "2026002",
      nextIfIssued: {
        sequential: "2026003",
        fromLast: "2026011",
      },
    });
  });

  it("persists plain numbering strategy to the workspace pool when usePrefix is false", async () => {
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
    await createEntry("2026-08-01", "2026-08-01");

    const may = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-05-01",
        to: "2026-05-31",
        usePrefix: false,
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
        usePrefix: false,
      }),
    });
    expect(june.headers.get("x-invoice-number")).toBe("2026002");

    await createEntry("2026-09-01", "2026-09-01");

    const august = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-08-01",
        to: "2026-08-31",
        usePrefix: false,
        invoiceNumber: "2026020",
        numberingStrategy: "from_last",
      }),
    });
    expect(august.headers.get("x-invoice-number")).toBe("2026020");

    await createEntry("2026-10-01", "2026-10-01");

    const september = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-09-01",
        to: "2026-09-30",
        usePrefix: false,
      }),
    });
    expect(september.headers.get("x-invoice-number")).toBe("2026021");
  });

  it("does not let a prefixed override on one Client affect another Client's prefixed sequence", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const hannahProject = await createProject(app, hannah.id, "Coaching");

    const createEntry = (projectId: string, from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry(bandaoProject.id, "2026-06-01", "2026-06-01");
    await createEntry(hannahProject.id, "2026-06-01", "2026-06-01");

    const bandaoOverride = await app.request("/api/invoices", {
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
    expect(bandaoOverride.status).toBe(201);
    expect(bandaoOverride.headers.get("x-invoice-number")).toBe("2026010");

    await createEntry(hannahProject.id, "2026-07-01", "2026-07-01");

    const hannahIssue = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
      }),
    });
    expect(hannahIssue.status).toBe(201);
    expect(hannahIssue.headers.get("x-invoice-number")).toBe("HAN2026001");
  });

  it("applies a plain override workspace-wide for subsequent plain suggestions", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const hannahProject = await createProject(app, hannah.id, "Coaching");

    const createEntry = (projectId: string, from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry(bandaoProject.id, "2026-06-01", "2026-06-01");
    await createEntry(hannahProject.id, "2026-06-01", "2026-06-01");

    const bandaoOverride = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        usePrefix: false,
        invoiceNumber: "2026010",
        numberingStrategy: "sequential",
      }),
    });
    expect(bandaoOverride.status).toBe(201);
    expect(bandaoOverride.headers.get("x-invoice-number")).toBe("2026010");

    await createEntry(hannahProject.id, "2026-07-01", "2026-07-01");

    const hannahPreview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(hannahPreview.headers.get("x-suggested-invoice-number")).toBe(
      "2026002",
    );

    const hannahIssue = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(hannahIssue.headers.get("x-invoice-number")).toBe("2026002");
  });

  it("applies a plain from_last override workspace-wide for subsequent plain suggestions", async () => {
    const bandao = await createClient(app, {
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });
    const hannah = await createClient(app, {
      name: "Hannah",
      legalName: "Hannah Coaching",
      addressLine1: "Main Street 1",
      addressLine2: "10115 Berlin",
    });
    const bandaoProject = await createProject(app, bandao.id, "Ondojo");
    const hannahProject = await createProject(app, hannah.id, "Coaching");

    const createEntry = (projectId: string, from: string, to: string) =>
      app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: "Work",
          startedAt: `${from}T10:00:00.000Z`,
          endedAt: `${to}T11:00:00.000Z`,
        }),
      });

    await createEntry(bandaoProject.id, "2026-06-01", "2026-06-01");
    await createEntry(hannahProject.id, "2026-06-01", "2026-06-01");

    const bandaoOverride = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        usePrefix: false,
        invoiceNumber: "2026010",
        numberingStrategy: "from_last",
      }),
    });
    expect(bandaoOverride.status).toBe(201);
    expect(bandaoOverride.headers.get("x-invoice-number")).toBe("2026010");

    await createEntry(hannahProject.id, "2026-07-01", "2026-07-01");

    const hannahPreview = await app.request("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(hannahPreview.headers.get("x-suggested-invoice-number")).toBe(
      "2026011",
    );

    const hannahIssue = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: hannah.id,
        from: "2026-07-01",
        to: "2026-07-31",
        usePrefix: false,
      }),
    });
    expect(hannahIssue.headers.get("x-invoice-number")).toBe("2026011");
  });

  it("rejects plain issue when Invoice Number is overridden without numberingStrategy", async () => {
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
        startedAt: "2026-06-01T10:00:00.000Z",
        endedAt: "2026-06-01T11:00:00.000Z",
      }),
    });

    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        usePrefix: false,
        invoiceNumber: "2026010",
      }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "numberingStrategy is required when overriding Invoice Number",
    });
  });

  it("persists Invoice Prefix to the Client on issue", async () => {
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
        startedAt: "2026-06-01T10:00:00.000Z",
        endedAt: "2026-06-01T11:00:00.000Z",
      }),
    });

    const issued = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
        invoicePrefix: "BD",
      }),
    });
    expect(issued.status).toBe(201);
    expect(issued.headers.get("x-invoice-number")).toBe("BD2026001");

    const client = await (
      await app.request(`/api/clients/${bandao.id}`)
    ).json();
    expect(client.invoicePrefix).toBe("BD");
  });
});
