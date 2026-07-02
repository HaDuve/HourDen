import type {
  CreateManualEntryInput,
  StartTimerInput,
  StopTimerInput,
  UpdateTimeEntryInput,
} from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  createManualEntry,
  deleteTimeEntry,
  getRunningTimer,
  listTimeEntriesForDate,
  startTimer,
  stopTimer,
  updateTimeEntry,
} from "./db/time-entries.js";
import { getCurrentWorkspaceId } from "./workspace.js";

async function readJsonBody<T>(
  c: { req: { json: () => Promise<T> }; json: (data: unknown, status?: number) => Response },
): Promise<T | Response> {
  try {
    return await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
}

export function createTimeEntriesRouter(pool: Pool) {
  const router = new Hono();

  router.get("/running", async (c) => {
    const entry = await getRunningTimer(pool, getCurrentWorkspaceId());
    return c.json({ entry });
  });

  router.get("/", async (c) => {
    const date = c.req.query("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "date query parameter is required (YYYY-MM-DD)" }, 400);
    }

    const entries = await listTimeEntriesForDate(pool, getCurrentWorkspaceId(), date);
    return c.json({ entries });
  });

  router.post("/timer", async (c) => {
    const body = await readJsonBody<StartTimerInput>(c);
    if (body instanceof Response) return body;

    const result = await startTimer(pool, getCurrentWorkspaceId(), body);
    if (result === "invalid_project") {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(result, 201);
  });

  router.post("/:id/stop", async (c) => {
    const body = await readJsonBody<StopTimerInput>(c);
    if (body instanceof Response) return body;

    const result = await stopTimer(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
      body,
    );

    if (result === "not_found") {
      return c.json({ error: "Time Entry not found" }, 404);
    }
    if (result === "not_running") {
      return c.json({ error: "Time Entry is not running" }, 409);
    }

    return c.json(result);
  });

  router.post("/", async (c) => {
    const body = await readJsonBody<CreateManualEntryInput>(c);
    if (body instanceof Response) return body;

    if (!body.startedAt || !body.endedAt) {
      return c.json({ error: "startedAt and endedAt are required" }, 400);
    }

    const result = await createManualEntry(pool, getCurrentWorkspaceId(), body);
    if (result === "invalid_range") {
      return c.json({ error: "endedAt must be after startedAt" }, 400);
    }
    if (result === "invalid_project") {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(result, 201);
  });

  router.patch("/:id", async (c) => {
    const body = await readJsonBody<UpdateTimeEntryInput>(c);
    if (body instanceof Response) return body;

    const result = await updateTimeEntry(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
      body,
    );

    if (result === "invoiced") {
      return c.json({ error: "Invoiced Time Entry is read-only" }, 409);
    }
    if (result === "invalid_project") {
      return c.json({ error: "Project not found" }, 404);
    }
    if (result === "cannot_reopen") {
      return c.json({ error: "Cannot reopen a stopped Time Entry" }, 409);
    }
    if (!result) {
      return c.json({ error: "Time Entry not found" }, 404);
    }

    return c.json(result);
  });

  router.delete("/:id", async (c) => {
    const result = await deleteTimeEntry(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
    );

    if (result === "not_found") {
      return c.json({ error: "Time Entry not found" }, 404);
    }
    if (result === "invoiced") {
      return c.json({ error: "Invoiced Time Entry is read-only" }, 409);
    }

    return c.body(null, 204);
  });

  return router;
}
