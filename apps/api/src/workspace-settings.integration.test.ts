import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createUserWithWorkspace } from "./db/workspaces.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { deleteFreshUserArtifacts } from "./test/integration-fixture.js";
import { loginAsOperator, withSessionCookie } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

const QA_EMAIL = "sender-qa@test.hourden.local";
const QA_PASSWORD = "QaTestPass1";
const QA_WORKSPACE = "Sender QA Workspace";

describe.skipIf(!databaseUrl)("workspace invoice sender settings", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });
  let operatorCookie: string;
  let qaCookie: string;
  let qaWorkspaceId: string;

  beforeAll(async () => {
    await runMigrationsForTests(pool);
    operatorCookie = await loginAsOperator(app);
  });

  beforeEach(async () => {
    await deleteFreshUserArtifacts(pool, QA_EMAIL, QA_WORKSPACE);

    const created = await createUserWithWorkspace(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    });
    qaWorkspaceId = created.workspaceId;

    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
    });
    qaCookie = loginRes.headers.get("set-cookie") ?? "";
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns the active Workspace Invoice Sender on GET", async () => {
    const res = await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie({}, operatorCookie),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.invoiceSender.name).toBeTruthy();
    expect(body.invoiceSender.email).toBeTruthy();
    expect(body.invoiceSender.iban).toBeTruthy();
  });

  it("updates Invoice Sender fields for the active Workspace", async () => {
    const res = await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "QA Sender GmbH",
            street: "Teststraße 1",
            city: "12345 Teststadt",
            taxNumber: "TAX-123",
            email: QA_EMAIL,
            phone: "+49 123 456",
            bankName: "Test Bank",
            iban: "DE00 0000 0000 0000 0000 00",
            bic: "TESTBICXXX",
          }),
        },
        qaCookie,
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.invoiceSender).toEqual({
      name: "QA Sender GmbH",
      street: "Teststraße 1",
      city: "12345 Teststadt",
      taxNumber: "TAX-123",
      email: QA_EMAIL,
      phone: "+49 123 456",
      bankName: "Test Bank",
      iban: "DE00 0000 0000 0000 0000 00",
      bic: "TESTBICXXX",
    });

    const row = await pool.query<{ sender_name: string | null; sender_bic: string | null }>(
      "SELECT sender_name, sender_bic FROM workspaces WHERE id = $1",
      [qaWorkspaceId],
    );
    expect(row.rows[0]?.sender_name).toBe("QA Sender GmbH");
    expect(row.rows[0]?.sender_bic).toBe("TESTBICXXX");
  });

  it("keeps Invoice Sender changes scoped to the active Workspace", async () => {
    await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "QA-only Sender",
            email: QA_EMAIL,
          }),
        },
        qaCookie,
      ),
    );

    const operatorRes = await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie({}, operatorCookie),
    );
    const operatorBody = await operatorRes.json();
    expect(operatorBody.invoiceSender.name).not.toBe("QA-only Sender");
  });

  it("rejects empty name or email", async () => {
    const res = await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "   " }),
        },
        qaCookie,
      ),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name cannot be empty" });
  });

  it("returns empty Invoice Sender and configured false for a new QA Workspace", async () => {
    const res = await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie({}, qaCookie),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.invoiceSender).toEqual({
      name: "",
      street: "",
      city: "",
      taxNumber: "",
      email: "",
      phone: "",
      bankName: "",
      iban: "",
      bic: "",
    });
  });

  it("returns configured false after a partial PATCH that does not set name", async () => {
    const res = await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ street: "Teststraße 1" }),
        },
        qaCookie,
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.invoiceSender.street).toBe("Teststraße 1");
    expect(body.invoiceSender.name).toBe("");
  });

  it("requires name and email together when either is provided", async () => {
    const res = await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "QA Sender GmbH" }),
        },
        qaCookie,
      ),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "email is required when name is provided",
    });
  });

  it("captures updated Invoice Sender on issue after PATCH", async () => {
    await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "QA Sender GmbH",
            email: QA_EMAIL,
            street: "Teststraße 1",
            city: "12345 Teststadt",
            iban: "DE00 0000 0000 0000 0000 00",
            bic: "TESTBICXXX",
          }),
        },
        qaCookie,
      ),
    );

    const clientRes = await app.request(
      "/api/clients",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Bandao",
            defaultRate: 60,
            legalName: "BANDAO Guidance GmbH",
            addressLine1: "Schloßbergstraße 1",
            addressLine2: "82319 Starnberg",
          }),
        },
        qaCookie,
      ),
    );
    const client = (await clientRes.json()) as { id: string };

    const projectRes = await app.request(
      "/api/projects",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
        },
        qaCookie,
      ),
    );
    const project = (await projectRes.json()) as { id: string };

    await app.request(
      "/api/time-entries",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            description: "Billable work",
            startedAt: "2026-06-18T10:00:00.000Z",
            endedAt: "2026-06-18T11:00:00.000Z",
          }),
        },
        qaCookie,
      ),
    );

    const issueRes = await app.request(
      "/api/invoices",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: client.id,
            from: "2026-06-01",
            to: "2026-06-30",
          }),
        },
        qaCookie,
      ),
    );

    expect(issueRes.status).toBe(201);

    const row = await pool.query<{ snapshot: { operator: { name: string; iban: string } } }>(
      `
        SELECT snapshot
        FROM invoices
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [qaWorkspaceId],
    );

    expect(row.rows[0]!.snapshot.operator.name).toBe("QA Sender GmbH");
    expect(row.rows[0]!.snapshot.operator.iban).toBe("DE00 0000 0000 0000 0000 00");
  });
});
