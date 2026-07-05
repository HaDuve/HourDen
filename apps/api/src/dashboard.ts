import { Hono } from "hono";
import type { Pool } from "pg";
import { getDashboardSummary } from "./db/dashboard.js";
import { getWorkspaceCalendarTimezone } from "./db/workspaces.js";
import { getCurrentWorkspaceId } from "./workspace.js";
import { parseDateRange } from "./parse-date-range.js";

export function createDashboardRouter(pool: Pool) {
  const router = new Hono();

  router.get("/", async (c) => {
    const range = parseDateRange(c.req.query("from"), c.req.query("to"));
    if (range === "invalid") {
      return c.json(
        {
          error:
            "from and to query parameters are required (YYYY-MM-DD), with from <= to",
        },
        400,
      );
    }

    const workspaceId = getCurrentWorkspaceId();
    const timeZone = await getWorkspaceCalendarTimezone(pool, workspaceId);
    const summary = await getDashboardSummary(
      pool,
      workspaceId,
      range.from,
      range.to,
      timeZone,
    );

    return c.json({
      from: range.from,
      to: range.to,
      ...summary,
    });
  });

  return router;
}
