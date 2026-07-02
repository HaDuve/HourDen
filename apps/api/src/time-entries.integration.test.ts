import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";

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

describe.skipIf(!databaseUrl)("Time Entry API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrations(pool);
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

  it("starts a Running Timer with no end time", async () => {
    const res = await app.request("/api/time-entries/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const entry = await res.json();
    expect(entry).toMatchObject({
      projectId: null,
      description: null,
      endedAt: null,
      isRunning: true,
      billableComplete: false,
      amount: null,
      invoiced: false,
    });
    expect(entry.startedAt).toBeTruthy();
    expect(entry.durationMinutes).toBeGreaterThanOrEqual(0);
  });

  it("stops the current Running Timer when starting another (one-active invariant)", async () => {
    const first = await (
      await app.request("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "First task" }),
      })
    ).json();

    const secondRes = await app.request("/api/time-entries/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Second task" }),
    });
    expect(secondRes.status).toBe(201);
    const second = await secondRes.json();
    expect(second.isRunning).toBe(true);

    const runningRes = await app.request("/api/time-entries/running");
    const { entry: running } = await runningRes.json();
    expect(running.id).toBe(second.id);

    const today = first.startedAt.slice(0, 10);
    const { entries } = await (
      await app.request(`/api/time-entries?date=${today}`)
    ).json();
    const stoppedFirst = entries.find((e: { id: string }) => e.id === first.id);
    expect(stoppedFirst.isRunning).toBe(false);
    expect(stoppedFirst.endedAt).toBeTruthy();
  });

  it("allows a bare timer start without Project or Description", async () => {
    const started = await (
      await app.request("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    ).json();

    expect(started.projectId).toBeNull();
    expect(started.description).toBeNull();

    const labeled = await (
      await app.request(`/api/time-entries/${started.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Labeled after start",
          projectId: (await createProject(app, (await createClient(app, "Bandao")).id, "Ondojo")).id,
        }),
      })
    ).json();

    expect(labeled.description).toBe("Labeled after start");
    expect(labeled.projectId).toBeTruthy();
  });

  it("requires a Description before a stopped entry is billable-complete", async () => {
    const started = await (
      await app.request("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    ).json();

    const stopped = await (
      await app.request(`/api/time-entries/${started.id}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    ).json();

    expect(stopped.endedAt).toBeTruthy();
    expect(stopped.billableComplete).toBe(false);

    const completed = await (
      await app.request(`/api/time-entries/${started.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Development work" }),
      })
    ).json();

    expect(completed.billableComplete).toBe(true);
  });

  it("rejects a Project from another workspace", async () => {
    const otherWorkspaceId = "b0000000-0000-4000-8000-000000000002";
    await pool.query(
      "INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [otherWorkspaceId, "Other Workspace"],
    );
    const foreignClient = await pool.query<{ id: string }>(
      `
        INSERT INTO clients (workspace_id, name, default_rate)
        VALUES ($1, 'Foreign Client', 50)
        RETURNING id
      `,
      [otherWorkspaceId],
    );
    const foreignProject = await pool.query<{ id: string }>(
      `
        INSERT INTO projects (workspace_id, client_id, name)
        VALUES ($1, $2, 'Foreign Project')
        RETURNING id
      `,
      [otherWorkspaceId, foreignClient.rows[0]!.id],
    );
    const foreignProjectId = foreignProject.rows[0]!.id;

    const timerRes = await app.request("/api/time-entries/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: foreignProjectId }),
    });
    expect(timerRes.status).toBe(404);

    const manualRes = await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: foreignProjectId,
        startedAt: "2026-07-02T08:00:00.000Z",
        endedAt: "2026-07-02T09:00:00.000Z",
        description: "Foreign project work",
      }),
    });
    expect(manualRes.status).toBe(404);

    const local = await (
      await app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: "2026-07-02T08:00:00.000Z",
          endedAt: "2026-07-02T09:00:00.000Z",
          description: "Local entry",
        }),
      })
    ).json();

    const patchRes = await app.request(`/api/time-entries/${local.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: foreignProjectId }),
    });
    expect(patchRes.status).toBe(404);
  });

  it("includes an overnight running timer on today's list", async () => {
    const { DEFAULT_WORKSPACE_ID } = await import("@hourden/domain");
    await pool.query(
      `
        INSERT INTO time_entries (workspace_id, started_at, description)
        VALUES ($1, $2, 'Overnight work')
      `,
      [DEFAULT_WORKSPACE_ID, "2026-07-01T22:00:00.000Z"],
    );

    const listRes = await app.request("/api/time-entries?date=2026-07-02");
    expect(listRes.status).toBe(200);
    const { entries } = await listRes.json();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      description: "Overnight work",
      isRunning: true,
    });
  });

  it("rejects reopening a stopped entry as running", async () => {
    const created = await (
      await app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: "2026-07-02T08:00:00.000Z",
          endedAt: "2026-07-02T09:00:00.000Z",
          description: "Completed work",
        }),
      })
    ).json();

    const res = await app.request(`/api/time-entries/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endedAt: null }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Cannot reopen a stopped Time Entry",
    });
  });

  it("computes amount from the Client rate for a completed entry", async () => {
    const client = await createClient(app, "Bandao", 60);
    const project = await createProject(app, client.id, "Ondojo");

    const startedAt = "2026-07-02T09:00:00.000Z";
    const endedAt = "2026-07-02T10:30:00.000Z";

    const res = await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        startedAt,
        endedAt,
        description: "Feature work",
      }),
    });

    expect(res.status).toBe(201);
    const entry = await res.json();
    expect(entry.durationMinutes).toBe(90);
    expect(entry.amount).toBe(90);
    expect(entry.billableComplete).toBe(true);
  });

  it("creates a Manual Entry with explicit start and end", async () => {
    const startedAt = "2026-07-02T14:00:00.000Z";
    const endedAt = "2026-07-02T15:00:00.000Z";

    const res = await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt,
        endedAt,
        description: "Backfilled meeting",
        tags: ["Communication"],
      }),
    });

    expect(res.status).toBe(201);
    const entry = await res.json();
    expect(entry).toMatchObject({
      startedAt,
      endedAt,
      description: "Backfilled meeting",
      tags: ["Communication"],
      isRunning: false,
      billableComplete: true,
    });
  });

  it("allows editing and deleting non-invoiced entries", async () => {
    const created = await (
      await app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: "2026-07-02T08:00:00.000Z",
          endedAt: "2026-07-02T09:00:00.000Z",
          description: "Draft entry",
        }),
      })
    ).json();

    const updated = await (
      await app.request(`/api/time-entries/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Updated entry" }),
      })
    ).json();
    expect(updated.description).toBe("Updated entry");

    const deleteRes = await app.request(`/api/time-entries/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const listRes = await app.request("/api/time-entries?date=2026-07-02");
    const { entries } = await listRes.json();
    expect(entries.find((e: { id: string }) => e.id === created.id)).toBeUndefined();
  });

  it("blocks editing and deleting invoiced entries", async () => {
    const client = await createClient(app, "Bandao", 60);
    const created = await (
      await app.request("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: "2026-07-02T08:00:00.000Z",
          endedAt: "2026-07-02T09:00:00.000Z",
          description: "Invoiced work",
        }),
      })
    ).json();

    const invoice = await pool.query<{ id: string }>(
      `
        INSERT INTO invoices (
          workspace_id,
          client_id,
          invoice_number,
          period_start,
          period_end,
          invoice_date,
          due_date,
          total_amount,
          total_duration_minutes
        )
        VALUES ($1, $2, '2026001', '2026-07-01', '2026-07-31', '2026-07-31', '2026-08-14', 60, 60)
        RETURNING id
      `,
      [DEFAULT_WORKSPACE_ID, client.id],
    );

    await pool.query("UPDATE time_entries SET invoice_id = $1 WHERE id = $2", [
      invoice.rows[0]!.id,
      created.id,
    ]);

    const patchRes = await app.request(`/api/time-entries/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Changed" }),
    });
    expect(patchRes.status).toBe(409);

    const deleteRes = await app.request(`/api/time-entries/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(409);
  });

  it("lists today's entries for the today view", async () => {
    await app.request("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: "2026-07-02T10:00:00.000Z",
        endedAt: "2026-07-02T11:00:00.000Z",
        description: "Morning work",
      }),
    });

    const running = await (
      await app.request("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Afternoon timer" }),
      })
    ).json();

    const listRes = await app.request("/api/time-entries?date=2026-07-02");
    expect(listRes.status).toBe(200);
    const { entries } = await listRes.json();

    expect(entries).toHaveLength(2);
    expect(entries.map((e: { description: string | null }) => e.description)).toEqual(
      expect.arrayContaining(["Morning work", "Afternoon timer"]),
    );
    expect(entries.find((e: { id: string }) => e.id === running.id)?.isRunning).toBe(true);
  });
});
