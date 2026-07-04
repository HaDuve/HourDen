import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { publishWorkspaceEvent } from "./events/workspace-bus.js";
import { loginAsOperator, withSessionCookie } from "./test/auth-helper.js";
import { readNextSseEvent } from "./test/sse-helper.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("SSE events API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });
  let sessionCookie: string;

  beforeAll(async () => {
    await runMigrations(pool);
    sessionCookie = await loginAsOperator(app);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("rejects unauthenticated connections", async () => {
    const res = await app.request("/api/events");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("streams workspace events with a valid session cookie", async () => {
    const res = await app.request(
      "/api/events",
      withSessionCookie({}, sessionCookie),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("Expected SSE response body");
    }

    publishWorkspaceEvent(DEFAULT_WORKSPACE_ID, "timer-changed");

    const event = await readNextSseEvent(reader);
    expect(event.event).toBe("timer-changed");

    await reader.cancel();
  });
});
