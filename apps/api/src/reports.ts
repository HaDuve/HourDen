import { buildClientReport, serializeClockifyCsv } from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  listReportEntriesForRange,
  reportTimeZone,
  rowsToClientReportInputs,
  rowsToClockifyExportEntries,
} from "./db/reports.js";
import { getCurrentWorkspaceId } from "./workspace.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateRange(
  from: string | undefined,
  to: string | undefined,
): { from: string; to: string } | "invalid" {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return "invalid";
  }
  if (from > to) {
    return "invalid";
  }
  return { from, to };
}

function clockifyExportOptions() {
  return {
    operatorName: process.env.HOURDEN_OPERATOR_NAME ?? "Hannes Duve",
    operatorEmail:
      process.env.HOURDEN_OPERATOR_EMAIL ?? "hannes.duve@outlook.com",
    timeZone: reportTimeZone(),
  };
}

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

    const timeZone = reportTimeZone();
    const rows = await listReportEntriesForRange(
      pool,
      getCurrentWorkspaceId(),
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

    const rows = await listReportEntriesForRange(
      pool,
      getCurrentWorkspaceId(),
      range.from,
      range.to,
      reportTimeZone(),
    );
    const csv = serializeClockifyCsv(
      rowsToClockifyExportEntries(rows),
      clockifyExportOptions(),
    );

    const filename = `Clockify_Time_Report_Detailed_${range.from}_${range.to}.csv`;
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(csv);
  });

  return router;
}
