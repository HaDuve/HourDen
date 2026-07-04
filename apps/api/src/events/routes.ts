import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import type { Pool } from "pg";
import { SESSION_COOKIE } from "../auth/session.js";
import { getCurrentWorkspaceId } from "../workspace.js";
import { createSessionValidator } from "./session-validator.js";
import { subscribe } from "./workspace-bus.js";
import type { WorkspaceEvent } from "./workspace-bus.js";

const DEFAULT_KEEPALIVE_INTERVAL_MS = 30_000;

export type EventsRouterOptions = {
  keepaliveIntervalMs?: number;
  validateSession?: (
    sessionId: string | undefined,
    workspaceId: string,
  ) => Promise<boolean>;
};

export function createEventsRouter(
  pool: Pool,
  options: EventsRouterOptions = {},
) {
  const keepaliveIntervalMs =
    options.keepaliveIntervalMs ?? DEFAULT_KEEPALIVE_INTERVAL_MS;
  const validateSession =
    options.validateSession ?? createSessionValidator(pool);
  const router = new Hono();

  router.get("/", (c) => {
    const workspaceId = getCurrentWorkspaceId();
    const sessionId = getCookie(c, SESSION_COOKIE);
    c.header("X-Accel-Buffering", "no");

    return streamSSE(c, async (stream) => {
      const unsubscribe = subscribe(workspaceId, async (event: WorkspaceEvent) => {
        if (stream.aborted) {
          return;
        }
        await stream.writeSSE({ event, data: "" });
      });

      stream.onAbort(() => {
        unsubscribe();
      });

      try {
        while (!stream.aborted) {
          await stream.sleep(keepaliveIntervalMs);
          if (stream.aborted) {
            break;
          }

          if (sessionId) {
            const stillValid = await validateSession(sessionId, workspaceId);
            if (!stillValid) {
              await stream.close();
              break;
            }
          }

          await stream.write(": keepalive\n\n");
        }
      } finally {
        unsubscribe();
      }
    });
  });

  return router;
}
