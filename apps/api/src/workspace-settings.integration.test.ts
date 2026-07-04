import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createUserWithWorkspace } from "./db/workspaces.js";
import { runMigrations } from "./db/migrate.js";
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
    await runMigrations(pool);
    operatorCookie = await loginAsOperator(app);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM workspace_memberships WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM workspaces WHERE name = $1", [QA_WORKSPACE]);
    await pool.query("DELETE FROM users WHERE email = $1", [QA_EMAIL]);

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
});
