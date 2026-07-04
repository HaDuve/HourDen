import { Hono } from "hono";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createEventsRouter } from "./events/routes.js";
import { publishWorkspaceEvent } from "./events/workspace-bus.js";
import { readNextSseEvent, readSseComment } from "./test/sse-helper.js";
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
    app.route("/events", createEventsRouter({} as Pool));

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

  it("closes the stream when the session is no longer valid", async () => {
    let sessionValid = true;
    const workspaceId = "test-workspace";
    const app = new Hono();
    app.use("*", async (_c, next) => runWithWorkspaceId(workspaceId, () => next()));
    app.route(
      "/events",
      createEventsRouter({} as Pool, {
        keepaliveIntervalMs: 20,
        validateSession: async () => sessionValid,
      }),
    );

    const res = await app.request("/events", {
      headers: {
        Cookie: "hourden_session=00000000-0000-4000-8000-000000000001",
      },
    });
    expect(res.status).toBe(200);

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("Expected SSE response body");
    }

    const keepalive = await readSseComment(reader, "keepalive");
    expect(keepalive).toBe(true);

    sessionValid = false;
    await new Promise((resolve) => setTimeout(resolve, 50));

    publishWorkspaceEvent(workspaceId, "timer-changed");
    await expect(readNextSseEvent(reader, 200)).rejects.toThrow(
      "Timed out waiting for SSE event",
    );

    await reader.cancel();
  });
});
