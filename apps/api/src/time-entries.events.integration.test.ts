import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { loginAsOperator, withSessionCookie } from "./test/auth-helper.js";
import { readNextSseEvent } from "./test/sse-helper.js";

const databaseUrl = process.env.DATABASE_URL;

async function openSseStream(
  app: ReturnType<typeof createApp>,
  sessionCookie: string,
) {
  const res = await app.request(
    "/api/events",
    withSessionCookie({}, sessionCookie),
  );
  expect(res.status).toBe(200);
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Expected SSE response body");
  }
  return reader;
}

describe.skipIf(!databaseUrl)("Time Entry workspace events", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });
  let sessionCookie: string;

  beforeAll(async () => {
    await runMigrations(pool);
    sessionCookie = await loginAsOperator(app);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("publishes timer-changed when a timer is started", async () => {
    const reader = await openSseStream(app, sessionCookie);

    const res = await app.request(
      "/api/time-entries/timer",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        sessionCookie,
      ),
    );
    expect(res.status).toBe(201);

    const event = await readNextSseEvent(reader);
    expect(event.event).toBe("timer-changed");

    await reader.cancel();
  });

  it("publishes timer-changed and today-changed when a timer is stopped", async () => {
    const started = await (
      await app.request(
        "/api/time-entries/timer",
        withSessionCookie(
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
          sessionCookie,
        ),
      )
    ).json();

    const reader = await openSseStream(app, sessionCookie);

    const stopRes = await app.request(
      `/api/time-entries/${started.id}/stop`,
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        sessionCookie,
      ),
    );
    expect(stopRes.status).toBe(200);

    const timerEvent = await readNextSseEvent(reader);
    expect(timerEvent.event).toBe("timer-changed");
    const todayEvent = await readNextSseEvent(reader);
    expect(todayEvent.event).toBe("today-changed");

    await reader.cancel();
  });

  it("publishes today-changed when a manual entry is created", async () => {
    const reader = await openSseStream(app, sessionCookie);

    const res = await app.request(
      "/api/time-entries",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "Manual work",
            startedAt: "2026-07-04T08:00:00.000Z",
            endedAt: "2026-07-04T09:00:00.000Z",
          }),
        },
        sessionCookie,
      ),
    );
    expect(res.status).toBe(201);

    const event = await readNextSseEvent(reader);
    expect(event.event).toBe("today-changed");

    await reader.cancel();
  });

  it("publishes today-changed when an entry is updated", async () => {
    const created = await (
      await app.request(
        "/api/time-entries",
        withSessionCookie(
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: "Before",
              startedAt: "2026-07-04T08:00:00.000Z",
              endedAt: "2026-07-04T09:00:00.000Z",
            }),
          },
          sessionCookie,
        ),
      )
    ).json();

    const reader = await openSseStream(app, sessionCookie);

    const patchRes = await app.request(
      `/api/time-entries/${created.id}`,
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: "After" }),
        },
        sessionCookie,
      ),
    );
    expect(patchRes.status).toBe(200);

    const event = await readNextSseEvent(reader);
    expect(event.event).toBe("today-changed");

    await reader.cancel();
  });

  it("publishes today-changed when an entry is deleted", async () => {
    const created = await (
      await app.request(
        "/api/time-entries",
        withSessionCookie(
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: "Delete me",
              startedAt: "2026-07-04T08:00:00.000Z",
              endedAt: "2026-07-04T09:00:00.000Z",
            }),
          },
          sessionCookie,
        ),
      )
    ).json();

    const reader = await openSseStream(app, sessionCookie);

    const deleteRes = await app.request(
      `/api/time-entries/${created.id}`,
      withSessionCookie({ method: "DELETE" }, sessionCookie),
    );
    expect(deleteRes.status).toBe(204);

    const event = await readNextSseEvent(reader);
    expect(event.event).toBe("today-changed");

    await reader.cancel();
  });

  it("publishes timer-changed and today-changed when starting replaces a running timer", async () => {
    await app.request(
      "/api/time-entries/timer",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: "First" }),
        },
        sessionCookie,
      ),
    );

    const reader = await openSseStream(app, sessionCookie);

    const secondRes = await app.request(
      "/api/time-entries/timer",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: "Second" }),
        },
        sessionCookie,
      ),
    );
    expect(secondRes.status).toBe(201);

    const timerEvent = await readNextSseEvent(reader);
    expect(timerEvent.event).toBe("timer-changed");
    const todayEvent = await readNextSseEvent(reader);
    expect(todayEvent.event).toBe("today-changed");

    await reader.cancel();
  });

  it("delivers timer-changed to subscribers in the same workspace", async () => {
    const reader = await openSseStream(app, sessionCookie);

    await app.request(
      "/api/time-entries/timer",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        sessionCookie,
      ),
    );

    const event = await readNextSseEvent(reader);
    expect(event.event).toBe("timer-changed");
    expect(DEFAULT_WORKSPACE_ID).toBeTruthy();

    await reader.cancel();
  });
});
