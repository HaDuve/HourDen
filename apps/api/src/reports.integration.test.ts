import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
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

describe.skipIf(!databaseUrl)("Report API", () => {
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

  it("returns Time Entries grouped by Client for a date range", async () => {
    const bandao = await createClient(app, "Bandao", 60);
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

    const res = await app.request(
      "/api/reports?from=2026-06-18&to=2026-06-18",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toEqual([
      {
        clientName: "Bandao",
        lines: [
          {
            date: "2026-06-18",
            description: "App Development",
            durationMinutes: 74,
            amount: 74,
          },
        ],
        totalDurationMinutes: 74,
        totalAmount: 74,
      },
    ]);
  });

  it("exports a Clockify-compatible CSV for a date range", async () => {
    const bandao = await createClient(app, "Bandao", 60);
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Development Call",
        tags: ["Communication"],
        startedAt: "2026-06-22T08:00:00.000Z",
        endedAt: "2026-06-22T08:13:00.000Z",
      }),
    });

    const res = await app.request(
      "/api/reports/export?from=2026-06-22&to=2026-06-22",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain('"Duration (h)"');
    expect(lines[1]).toContain('"Ondojo"');
    expect(lines[1]).toContain('"Bandao"');
    expect(lines[1]).toContain('"Development Call"');
    expect(lines[1]).toContain('"Communication"');
    expect(lines[1]).toContain('"0:13"');
    expect(lines[1]).toContain('"13.00"');
  });

  it("excludes incomplete stopped entries without a Description", async () => {
    const bandao = await createClient(app, "Bandao", 60);
    const ondojo = await createProject(app, bandao.id, "Ondojo");

    const timer = await (
      await app.request("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: ondojo.id }),
      })
    ).json();

    await app.request(`/api/time-entries/${timer.id}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

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

    const res = await app.request(
      "/api/reports?from=2026-06-18&to=2026-06-18",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toEqual([
      {
        clientName: "Bandao",
        lines: [
          {
            date: "2026-06-18",
            description: "Billable work",
            durationMinutes: 60,
            amount: 60,
          },
        ],
        totalDurationMinutes: 60,
        totalAmount: 60,
      },
    ]);
  });

  it("filters and groups by the workspace calendar timezone", async () => {
    const workspaceBefore = await pool.query<{ calendar_timezone: string | null }>(
      "SELECT calendar_timezone FROM workspaces WHERE id = $1",
      [DEFAULT_WORKSPACE_ID],
    );
    const previousTz = workspaceBefore.rows[0]!.calendar_timezone;

    try {
      await pool.query(
        "UPDATE workspaces SET calendar_timezone = $2 WHERE id = $1",
        [DEFAULT_WORKSPACE_ID, "Europe/Berlin"],
      );
      const bandao = await createClient(app, "Bandao", 60);
      const ondojo = await createProject(app, bandao.id, "Ondojo");

      await app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ondojo.id,
          description: "Late night work",
          startedAt: "2026-05-31T22:30:00.000Z",
          endedAt: "2026-05-31T23:30:00.000Z",
        }),
      });

      const juneReport = await app.request(
        "/api/reports?from=2026-06-01&to=2026-06-01",
      );
      const mayReport = await app.request(
        "/api/reports?from=2026-05-31&to=2026-05-31",
      );

      expect((await juneReport.json()).clients).toHaveLength(1);
      expect((await mayReport.json()).clients).toEqual([]);

      const exportRes = await app.request(
        "/api/reports/export?from=2026-06-01&to=2026-06-01",
      );
      const csv = await exportRes.text();
      expect(csv).toContain('"01/06/2026"');
      expect(csv).toContain('"Late night work"');
    } finally {
      await pool.query(
        "UPDATE workspaces SET calendar_timezone = $2 WHERE id = $1",
        [DEFAULT_WORKSPACE_ID, previousTz],
      );
    }
  });
});
