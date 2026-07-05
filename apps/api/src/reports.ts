import { buildClientReport, serializeClockifyCsv } from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  listReportEntriesForRange,
  rowsToClientReportInputs,
  rowsToClockifyExportEntries,
} from "./db/reports.js";
import {
  getWorkspaceBillingContext,
  getWorkspaceCalendarTimezone,
} from "./db/workspaces.js";
import { getCurrentWorkspaceId } from "./workspace.js";
import { parseDateRange } from "./parse-date-range.js";

export function createReportsRouter(pool: Pool) {
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
    const rows = await listReportEntriesForRange(
      pool,
      workspaceId,
      range.from,
      range.to,
      timeZone,
    );
    const clients = buildClientReport(rowsToClientReportInputs(rows, timeZone));

    return c.json({
      from: range.from,
      to: range.to,
      clients,
    });
  });

  router.get("/export", async (c) => {
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
    const { calendarTimezone: timeZone, operator } =
      await getWorkspaceBillingContext(pool, workspaceId);
    const rows = await listReportEntriesForRange(
      pool,
      workspaceId,
      range.from,
      range.to,
      timeZone,
    );
    const csv = serializeClockifyCsv(rowsToClockifyExportEntries(rows), {
      operatorName: operator.name,
      operatorEmail: operator.email,
      timeZone,
    });

    const filename = `Clockify_Time_Report_Detailed_${range.from}_${range.to}.csv`;
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(csv);
  });

  return router;
}
