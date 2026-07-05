import { toLocalDateKey } from "@hourden/domain";
import type { Pool } from "pg";

type DashboardEntryRow = {
  started_at: Date;
  ended_at: Date;
  amount: string | null;
  project_name: string | null;
  client_name: string | null;
};

export type DashboardDailyBucket = {
  date: string;
  durationMinutes: number;
};

export type DashboardNamedTotal = {
  name: string;
  durationMinutes: number;
};

export type DashboardSummary = {
  from: string;
  to: string;
  totalDurationMinutes: number;
  totalBillableAmount: number;
  topProject: DashboardNamedTotal | null;
  topClient: DashboardNamedTotal | null;
  dailyBuckets: DashboardDailyBucket[];
};

function durationMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

function topByDuration(
  totals: Map<string, number>,
): DashboardNamedTotal | null {
  let top: DashboardNamedTotal | null = null;

  for (const [name, durationMinutes] of totals) {
    if (!name || (top !== null && durationMinutes <= top.durationMinutes)) {
      continue;
    }
    top = { name, durationMinutes };
  }

  return top;
}

export async function getDashboardSummary(
  pool: Pool,
  workspaceId: string,
  from: string,
  to: string,
  timeZone: string,
): Promise<Omit<DashboardSummary, "from" | "to">> {
  const result = await pool.query<DashboardEntryRow>(
    `
      SELECT
        te.started_at,
        te.ended_at,
        te.amount,
        p.name AS project_name,
        c.name AS client_name
      FROM time_entries te
      LEFT JOIN projects p ON p.id = te.project_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE te.workspace_id = $1
        AND te.ended_at IS NOT NULL
        AND ((te.started_at AT TIME ZONE $4)::date >= $2::date)
        AND ((te.started_at AT TIME ZONE $4)::date <= $3::date)
      ORDER BY te.started_at ASC
    `,
    [workspaceId, from, to, timeZone],
  );

  let totalDurationMinutes = 0;
  let totalBillableAmount = 0;
  const projectTotals = new Map<string, number>();
  const clientTotals = new Map<string, number>();
  const dailyTotals = new Map<string, number>();

  for (const row of result.rows) {
    const mins = durationMinutes(row.started_at, row.ended_at);
    const amount = row.amount !== null ? Number(row.amount) : 0;
    const date = toLocalDateKey(row.started_at, timeZone);

    totalDurationMinutes += mins;
    totalBillableAmount += amount;

    if (row.project_name) {
      projectTotals.set(
        row.project_name,
        (projectTotals.get(row.project_name) ?? 0) + mins,
      );
    }

    if (row.client_name) {
      clientTotals.set(
        row.client_name,
        (clientTotals.get(row.client_name) ?? 0) + mins,
      );
    }

    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + mins);
  }

  const dailyBuckets = [...dailyTotals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, durationMinutes]) => ({ date, durationMinutes }));

  return {
    totalDurationMinutes,
    totalBillableAmount: Math.round(totalBillableAmount * 100) / 100,
    topProject: topByDuration(projectTotals),
    topClient: topByDuration(clientTotals),
    dailyBuckets,
  };
}
