/**
 * Seeds a local demo workspace that mirrors the README screenshot layout
 * with anonymised client/project names and amounts.
 */
import "../apps/api/src/load-env.js";
import { Pool } from "pg";
import { createApp } from "../apps/api/src/app.js";
import { createUserWithWorkspace } from "../apps/api/src/db/workspaces.js";
import { resetWorkspace } from "../apps/api/src/test/reset-workspace.js";

const DEMO_EMAIL = "screenshots@hourden.local";
const DEMO_PASSWORD = "DemoPass1";
const DEMO_WORKSPACE = "Screenshot Demo";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://hourden:hourden@localhost:5433/hourden";

type App = ReturnType<typeof createApp>;

function berlinIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const local = new Date(Date.UTC(year, month - 1, day, hour - 2, minute));
  return local.toISOString();
}

async function login(app: App) {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  if (res.status !== 200) {
    throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Missing session cookie");
  }
  return cookie;
}

function withCookie(cookie: string, init: RequestInit = {}) {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      cookie,
    },
  };
}

async function createClient(
  app: App,
  cookie: string,
  input: {
    name: string;
    defaultRate: number;
    legalName: string;
    addressLine1: string;
    addressLine2: string;
    invoicePrefix?: string;
  },
) {
  const res = await app.request(
    "/api/clients",
    withCookie(cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultRate: input.defaultRate,
        name: input.name,
        legalName: input.legalName,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
      }),
    }),
  );
  if (res.status !== 201) {
    throw new Error(`Create client failed (${res.status}): ${await res.text()}`);
  }
  const client = (await res.json()) as { id: string };
  if (input.invoicePrefix) {
    await app.request(
      `/api/clients/${client.id}`,
      withCookie(cookie, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoicePrefix: input.invoicePrefix }),
      }),
    );
  }
  return client;
}

async function createProject(
  app: App,
  cookie: string,
  clientId: string,
  name: string,
) {
  const res = await app.request(
    "/api/projects",
    withCookie(cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, name }),
    }),
  );
  if (res.status !== 201) {
    throw new Error(`Create project failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { id: string };
}

async function createEntry(
  app: App,
  cookie: string,
  projectId: string,
  description: string,
  startedAt: string,
  endedAt: string,
) {
  const res = await app.request(
    "/api/time-entries",
    withCookie(cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, description, startedAt, endedAt }),
    }),
  );
  if (res.status !== 201) {
    throw new Error(`Create entry failed (${res.status}): ${await res.text()}`);
  }
}

async function issueInvoice(
  app: App,
  cookie: string,
  clientId: string,
  from: string,
  to: string,
) {
  const res = await app.request(
    "/api/invoices",
    withCookie(cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, from, to }),
    }),
  );
  if (res.status !== 201) {
    throw new Error(`Issue invoice failed (${res.status}): ${await res.text()}`);
  }
  const invoiceNumber = res.headers.get("X-Invoice-Number");
  if (!invoiceNumber) {
    throw new Error("Missing X-Invoice-Number header");
  }
  const listRes = await app.request("/api/invoices", withCookie(cookie));
  const listBody = (await listRes.json()) as {
    invoices: Array<{ id: string; invoiceNumber: string }>;
  };
  const invoice = listBody.invoices.find(
    (row) => row.invoiceNumber === invoiceNumber,
  );
  if (!invoice) {
    throw new Error(`Issued invoice ${invoiceNumber} not found in list`);
  }
  return invoice;
}

async function markSent(app: App, cookie: string, invoiceId: string) {
  const res = await app.request(
    `/api/invoices/${invoiceId}/mark-sent`,
    withCookie(cookie, { method: "POST" }),
  );
  if (res.status !== 200) {
    throw new Error(`Mark sent failed (${res.status}): ${await res.text()}`);
  }
}

async function seed(app: App, cookie: string) {
  await app.request(
    "/api/workspace/invoice-sender",
    withCookie(cookie, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Max Muster",
        street: "Musterstraße 12",
        city: "10115 Berlin",
        email: "max.muster@example.com",
        phone: "+49 30 1234567",
        taxNumber: "DE123456789",
        bankName: "Musterbank",
        iban: "DE89370400440532013000",
        bic: "COBADEFFXXX",
      }),
    }),
  );

  const nordex = await createClient(app, cookie, {
    name: "Nordex",
    defaultRate: 60,
    legalName: "NORDEX Guidance GmbH",
    addressLine1: "Beispielweg 1",
    addressLine2: "80331 München",
    invoicePrefix: "NEX",
  });
  const lisa = await createClient(app, cookie, {
    name: "Lisa",
    defaultRate: 80,
    legalName: "Lisa Mayer",
    addressLine1: "Demoplatz 4",
    addressLine2: "20095 Hamburg",
    invoicePrefix: "LIS",
  });

  const appify = await createProject(app, cookie, nordex.id, "Appify");
  const consulting = await createProject(app, cookie, lisa.id, "Consulting");

  const add = (
    projectId: string,
    description: string,
    y: number,
    m: number,
    d: number,
    sh: number,
    sm: number,
    eh: number,
    em: number,
  ) =>
    createEntry(
      app,
      cookie,
      projectId,
      description,
      berlinIso(y, m, d, sh, sm),
      berlinIso(y, m, d, eh, em),
    );

  // September 2026 — open entries (Tracker top section)
  await add(appify.id, "App Development", 2026, 9, 1, 9, 39, 10, 47);
  await add(appify.id, "App Development", 2026, 9, 1, 11, 0, 13, 0);
  await add(appify.id, "App Development", 2026, 9, 1, 14, 0, 15, 18);
  await add(appify.id, "App Development", 2026, 9, 1, 18, 43, 21, 52);

  // August 2026 — invoiced (Dashboard + Tracker "Dieser Monat")
  await add(appify.id, "App Development", 2026, 8, 1, 9, 0, 14, 0);
  await add(appify.id, "App Development", 2026, 8, 3, 10, 0, 16, 11);
  await add(appify.id, "App Development", 2026, 8, 4, 9, 0, 12, 22);
  await add(appify.id, "Development Call", 2026, 8, 10, 9, 45, 10, 0);
  await add(appify.id, "App Development", 2026, 8, 10, 10, 6, 12, 24);
  await add(appify.id, "App Development", 2026, 8, 10, 12, 38, 15, 31);

  // Earlier months for issued-invoice list
  await add(appify.id, "App Development", 2026, 6, 15, 10, 0, 11, 0);
  await add(appify.id, "App Development", 2026, 7, 8, 9, 0, 12, 0);
  await add(consulting.id, "Workshop", 2026, 7, 12, 13, 0, 15, 0);

  const june = await issueInvoice(app, cookie, nordex.id, "2026-06-01", "2026-06-30");
  await markSent(app, cookie, june.id);

  const julyNordex = await issueInvoice(
    app,
    cookie,
    nordex.id,
    "2026-07-01",
    "2026-07-31",
  );
  await markSent(app, cookie, julyNordex.id);

  const julyLisa = await issueInvoice(app, cookie, lisa.id, "2026-07-01", "2026-07-31");

  const august = await issueInvoice(app, cookie, nordex.id, "2026-08-01", "2026-08-31");
  await markSent(app, cookie, august.id);

  await app.request(
    "/api/workspace/onboarding",
    withCookie(cookie, { method: "PATCH" }),
  );

  return { augustInvoiceId: august.id, augustInvoiceNumber: august.invoiceNumber };
}

const pool = new Pool({ connectionString: databaseUrl });
const app = createApp({ pool });

async function deleteDemoUser(pool: Pool) {
  await pool.query(
    "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    [DEMO_EMAIL],
  );
  await pool.query(
    "DELETE FROM workspace_memberships WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    [DEMO_EMAIL],
  );
  const workspaceRow = await pool.query<{ id: string }>(
    "SELECT id FROM workspaces WHERE name = $1",
    [DEMO_WORKSPACE],
  );
  const workspaceId = workspaceRow.rows[0]?.id;
  if (workspaceId) {
    await resetWorkspace(pool, workspaceId);
  }
  await pool.query("DELETE FROM workspaces WHERE name = $1", [DEMO_WORKSPACE]);
  await pool.query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);
}

async function main() {
  try {
    await deleteDemoUser(pool);
    await createUserWithWorkspace(pool, {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      workspaceName: DEMO_WORKSPACE,
      locale: "de",
      calendarTimezone: "Europe/Berlin",
      sender: {
        name: "Max Muster",
        email: "max.muster@example.com",
      },
    });

    const cookie = await login(app);
    const issued = await seed(app, cookie);

    console.log(
      JSON.stringify(
        {
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          loginUrl: "http://localhost:5173/login",
          augustInvoiceNumber: issued.augustInvoiceNumber,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

void main();
