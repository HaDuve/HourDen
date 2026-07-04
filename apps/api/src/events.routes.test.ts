import { Hono } from "hono";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createEventsRouter } from "./events/routes.js";
import { publishWorkspaceEvent } from "./events/workspace-bus.js";
import { readNextSseEvent } from "./test/sse-helper.js";
import { runWithWorkspaceId } from "./workspace.js";

describe("SSE events route", () => {
  it("rejects unauthenticated connections", async () => {
    const pool = {
      query: () => {
        throw new Error("Database should not be queried without a session cookie");
      },
    } as unknown as Pool;
    const app = createApp({ pool });

    const res = await app.request("/api/events");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("streams workspace events to subscribers in that workspace", async () => {
    const workspaceId = "test-workspace";
    const app = new Hono();
    app.use("*", async (_c, next) => runWithWorkspaceId(workspaceId, () => next()));
    app.route("/events", createEventsRouter());

    const res = await app.request("/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("Expected SSE response body");
    }

    publishWorkspaceEvent(workspaceId, "today-changed");

    const event = await readNextSseEvent(reader);
    expect(event.event).toBe("today-changed");

    await reader.cancel();
  });
});
