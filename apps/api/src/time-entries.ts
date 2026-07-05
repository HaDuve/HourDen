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
  listDescriptionSuggestions,
  listTrackerTimeEntries,
  listTimeEntriesForDate,
  startTimer,
  stopTimer,
  updateTimeEntry,
} from "./db/time-entries.js";
import { getWorkspaceCalendarTimezone } from "./db/workspaces.js";
import {
  notifyRunningTimerChanged,
  notifyTimerMutation,
  notifyTrackerEntriesChanged,
} from "./events/notify-tracker.js";
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

  router.get("/suggestions", async (c) => {
    const query = c.req.query("q") ?? "";
    const suggestions = await listDescriptionSuggestions(
      pool,
      getCurrentWorkspaceId(),
      query,
    );
    return c.json({ suggestions });
  });

  router.get("/", async (c) => {
    const date = c.req.query("date");
    const limitParam = c.req.query("limit");

    if (date && limitParam) {
      return c.json({ error: "Use either date or limit, not both" }, 400);
    }

    const workspaceId = getCurrentWorkspaceId();

    if (limitParam) {
      const limit = Number(limitParam);
      if (![50, 100, 200].includes(limit)) {
        return c.json({ error: "limit must be 50, 100, or 200" }, 400);
      }

      const entries = await listTrackerTimeEntries(pool, workspaceId, limit);
      return c.json({ entries });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "date or limit query parameter is required" }, 400);
    }

    const timeZone = await getWorkspaceCalendarTimezone(pool, workspaceId);
    const entries = await listTimeEntriesForDate(pool, workspaceId, date, timeZone);
    return c.json({ entries });
  });

  router.post("/timer", async (c) => {
    const body = await readJsonBody<StartTimerInput>(c);
    if (body instanceof Response) return body;

    const result = await startTimer(pool, getCurrentWorkspaceId(), body);
    if (result === "invalid_project") {
      return c.json({ error: "Project not found" }, 404);
    }

    notifyTimerMutation(getCurrentWorkspaceId());
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

    notifyTimerMutation(getCurrentWorkspaceId());
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

    notifyTrackerEntriesChanged(getCurrentWorkspaceId());
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

    const workspaceId = getCurrentWorkspaceId();
    if (result.isRunning) {
      notifyRunningTimerChanged(workspaceId);
    }
    notifyTrackerEntriesChanged(workspaceId);
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

    notifyTrackerEntriesChanged(getCurrentWorkspaceId());
    return c.body(null, 204);
  });

  return router;
}
