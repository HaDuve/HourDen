import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { bindSessionAuth } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

async function createClient(
  app: ReturnType<typeof createApp>,
  name: string,
  defaultRate = 60,
) {
  const res = await app.request("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, defaultRate }),
  });
  return res.json() as Promise<{ id: string; name: string; defaultRate: number }>;
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
  return res.json() as Promise<{ id: string; clientId: string; name: string }>;
}

describe.skipIf(!databaseUrl)("Dashboard API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrations(pool);
    await bindSessionAuth(app);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM invoices");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns totals, top project/client, and daily buckets for a date range", async () => {
    const bandao = await createClient(app, "Bandao", 60);
    const ondojo = await createProject(app, bandao.id, "Ondojo");
    const otherClient = await createClient(app, "Acme", 120);
    const otherProject = await createProject(app, otherClient.id, "Website");

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
        description: "Planning",
        startedAt: "2026-06-18T09:43:00.000Z",
        endedAt: "2026-06-18T09:51:00.000Z",
      }),
    });

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: otherProject.id,
        description: "Homepage",
        startedAt: "2026-06-19T10:00:00.000Z",
        endedAt: "2026-06-19T11:00:00.000Z",
      }),
    });

    const res = await app.request(
      "/api/dashboard?from=2026-06-18&to=2026-06-19",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      from: "2026-06-18",
      to: "2026-06-19",
      totalDurationMinutes: 134,
      totalBillableAmount: 194,
      topProject: { name: "Ondojo", durationMinutes: 74 },
      topClient: { name: "Bandao", durationMinutes: 74 },
      dailyBuckets: [
        { date: "2026-06-18", durationMinutes: 74 },
        { date: "2026-06-19", durationMinutes: 60 },
      ],
      clientBuckets: [
        { name: "Bandao", durationMinutes: 74 },
        { name: "Acme", durationMinutes: 60 },
      ],
      topActivities: [
        {
          description: "App Development",
          projectName: "Ondojo",
          clientName: "Bandao",
          durationMinutes: 66,
        },
        {
          description: "Homepage",
          projectName: "Website",
          clientName: "Acme",
          durationMinutes: 60,
        },
        {
          description: "Planning",
          projectName: "Ondojo",
          clientName: "Bandao",
          durationMinutes: 8,
        },
      ],
    });
  });

  it("returns 400 when the date range is invalid", async () => {
    const res = await app.request("/api/dashboard?from=2026-06-30&to=2026-06-01");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/from and to/i);
  });

  it("includes an unassigned client bucket for entries without a project", async () => {
    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Internal admin",
        startedAt: "2026-06-20T09:00:00.000Z",
        endedAt: "2026-06-20T10:00:00.000Z",
      }),
    });

    const res = await app.request(
      "/api/dashboard?from=2026-06-20&to=2026-06-20",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalDurationMinutes).toBe(60);
    expect(body.clientBuckets).toEqual([{ name: null, durationMinutes: 60 }]);
    expect(body.topActivities).toEqual([
      {
        description: "Internal admin",
        projectName: null,
        clientName: null,
        durationMinutes: 60,
      },
    ]);
  });

  it("returns zero totals when there is no tracked time in the range", async () => {
    const res = await app.request(
      "/api/dashboard?from=2026-06-01&to=2026-06-30",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
      totalDurationMinutes: 0,
      totalBillableAmount: 0,
      topProject: null,
      topClient: null,
      dailyBuckets: [],
      clientBuckets: [],
      topActivities: [],
    });
  });
});
