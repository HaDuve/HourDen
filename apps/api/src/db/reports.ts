import {
  DEFAULT_REPORT_TIMEZONE,
  toLocalDateKey,
  type ClientReportInput,
  type ClockifyExportEntry,
} from "@hourden/domain";
import type { Pool } from "pg";

type ReportEntryRow = {
  id: string;
  project_name: string | null;
  client_name: string | null;
  client_default_rate: string | null;
  started_at: Date;
  ended_at: Date;
  description: string | null;
  tags: string[];
  billable: boolean;
  amount: string | null;
};

function durationMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

export function reportTimeZone(): string {
  return DEFAULT_REPORT_TIMEZONE;
}

export async function listReportEntriesForRange(
  pool: Pool,
  workspaceId: string,
  from: string,
  to: string,
  timeZone = reportTimeZone(),
): Promise<ReportEntryRow[]> {
  const result = await pool.query<ReportEntryRow>(
    `
      SELECT
        te.id,
        p.name AS project_name,
        c.name AS client_name,
        c.default_rate AS client_default_rate,
        te.started_at,
        te.ended_at,
        te.description,
        te.tags,
        te.billable,
        te.amount
      FROM time_entries te
      LEFT JOIN projects p ON p.id = te.project_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE te.workspace_id = $1
        AND te.ended_at IS NOT NULL
        AND te.description IS NOT NULL
        AND trim(te.description) <> ''
        AND ((te.started_at AT TIME ZONE $4)::date >= $2::date)
        AND ((te.started_at AT TIME ZONE $4)::date <= $3::date)
      ORDER BY te.started_at ASC
    `,
    [workspaceId, from, to, timeZone],
  );

  return result.rows;
}

export function rowsToClientReportInputs(
  rows: ReportEntryRow[],
  timeZone = reportTimeZone(),
): ClientReportInput[] {
  return rows.map((row) => ({
    clientName: row.client_name ?? "",
    date: toLocalDateKey(row.started_at, timeZone),
    description: row.description?.trim() ?? "",
    durationMinutes: durationMinutes(row.started_at, row.ended_at),
    amount: row.amount !== null ? Number(row.amount) : 0,
  }));
}

export function rowsToClockifyExportEntries(
  rows: ReportEntryRow[],
): ClockifyExportEntry[] {
  return rows.map((row) => ({
    projectName: row.project_name ?? "",
    clientName: row.client_name ?? "",
    description: row.description?.trim() ?? "",
    tags: row.tags ?? [],
    billable: row.billable,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: durationMinutes(row.started_at, row.ended_at),
    billableRate:
      row.client_default_rate !== null ? Number(row.client_default_rate) : 0,
    billableAmount: row.amount !== null ? Number(row.amount) : 0,
  }));
}
