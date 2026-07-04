import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createUserWithWorkspace } from "./db/workspaces.js";
import { runMigrations } from "./db/migrate.js";
import { loginAsOperator, withSessionCookie } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

const QA_EMAIL = "qa@test.hourden.local";
const QA_PASSWORD = "QaTestPass1";
const QA_WORKSPACE = "QA Workspace";

describe.skipIf(!databaseUrl)("create-user", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM workspace_memberships WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM time_entries WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)", [
      QA_WORKSPACE,
    ]);
    await pool.query("DELETE FROM clients WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)", [
      QA_WORKSPACE,
    ]);
    await pool.query("DELETE FROM workspaces WHERE name = $1", [QA_WORKSPACE]);
    await pool.query("DELETE FROM users WHERE email = $1", [QA_EMAIL]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a User, Workspace, and owner Membership", async () => {
    const created = await createUserWithWorkspace(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    });

    const membership = await pool.query(
      `
        SELECT wm.role
        FROM workspace_memberships wm
        JOIN users u ON u.id = wm.user_id
        WHERE u.email = $1 AND wm.workspace_id = $2
      `,
      [QA_EMAIL, created.workspaceId],
    );

    expect(membership.rowCount).toBe(1);
    expect(membership.rows[0]?.role).toBe("owner");
  });

  it("rejects weak passwords", async () => {
    await expect(
      createUserWithWorkspace(pool, {
        email: QA_EMAIL,
        password: "weak",
        workspaceName: QA_WORKSPACE,
      }),
    ).rejects.toThrow(/at least 8 characters/);
  });

  it("lets a new User log in and see an empty Clients list", async () => {
    await createUserWithWorkspace(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    });

    const cookie = await loginAsOperator(app, QA_EMAIL, QA_PASSWORD);
    const res = await app.request("/api/clients", withSessionCookie({}, cookie));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clients: [] });
  });

  it("keeps operator and QA workspace data isolated", async () => {
    await createUserWithWorkspace(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    });

    const qaCookie = await loginAsOperator(app, QA_EMAIL, QA_PASSWORD);
    const createRes = await app.request(
      "/api/clients",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "QA Client", defaultRate: 60 }),
        },
        qaCookie,
      ),
    );
    expect(createRes.status).toBe(201);

    const operatorCookie = await loginAsOperator(app);
    const operatorClients = await app.request(
      "/api/clients",
      withSessionCookie({}, operatorCookie),
    );
    const operatorBody = await operatorClients.json();

    const qaClients = await app.request(
      "/api/clients",
      withSessionCookie({}, qaCookie),
    );
    const qaBody = await qaClients.json();

    expect(operatorBody.clients.some((c: { name: string }) => c.name === "QA Client")).toBe(
      false,
    );
    expect(qaBody.clients).toHaveLength(1);
    expect(qaBody.clients[0]?.name).toBe("QA Client");
  });
});
