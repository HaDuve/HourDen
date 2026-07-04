import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getCurrentWorkspaceId } from "../workspace.js";
import { subscribe } from "./workspace-bus.js";
import type { WorkspaceEvent } from "./workspace-bus.js";

export function createEventsRouter(): Hono {
  const router = new Hono();

  router.get("/", (c) => {
    const workspaceId = getCurrentWorkspaceId();
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
          await stream.sleep(30_000);
        }
      } finally {
        unsubscribe();
      }
    });
  });

  return router;
}
