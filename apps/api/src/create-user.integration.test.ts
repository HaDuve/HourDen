import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createUserWithWorkspace } from "./db/workspaces.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { deleteFreshUserArtifacts } from "./test/integration-fixture.js";
import { loginAsOperator, withSessionCookie } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

const QA_EMAIL = "qa@test.hourden.local";
const QA_PASSWORD = "QaTestPass1";
const QA_WORKSPACE = "QA Workspace";

describe.skipIf(!databaseUrl)("create-user", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrationsForTests(pool);
  });

  beforeEach(async () => {
    await deleteFreshUserArtifacts(pool, QA_EMAIL, QA_WORKSPACE);
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

  it("creates a Workspace with empty Invoice Sender fields", async () => {
    const created = await createUserWithWorkspace(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    });

    const workspace = await pool.query<{
      sender_name: string | null;
      sender_street: string | null;
      sender_email: string | null;
      sender_iban: string | null;
    }>(
      `
        SELECT sender_name, sender_street, sender_email, sender_iban
        FROM workspaces
        WHERE id = $1
      `,
      [created.workspaceId],
    );

    expect(workspace.rows[0]).toEqual({
      sender_name: null,
      sender_street: null,
      sender_email: null,
      sender_iban: null,
    });
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

  it("lets a new User log in and see empty Clients, Projects, and Time Entries", async () => {
    await createUserWithWorkspace(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    });

    const cookie = await loginAsOperator(app, QA_EMAIL, QA_PASSWORD);

    const clientsRes = await app.request("/api/clients", withSessionCookie({}, cookie));
    expect(clientsRes.status).toBe(200);
    expect(await clientsRes.json()).toEqual({ clients: [] });

    const projectsRes = await app.request("/api/projects", withSessionCookie({}, cookie));
    expect(projectsRes.status).toBe(200);
    expect(await projectsRes.json()).toEqual({ projects: [] });

    const meRes = await app.request("/api/auth/me", withSessionCookie({}, cookie));
    const { calendarTimezone } = (await meRes.json()) as { calendarTimezone: string };
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: calendarTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const entriesRes = await app.request(
      `/api/time-entries?date=${today}`,
      withSessionCookie({}, cookie),
    );
    expect(entriesRes.status).toBe(200);
    expect(await entriesRes.json()).toEqual({ entries: [] });
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
