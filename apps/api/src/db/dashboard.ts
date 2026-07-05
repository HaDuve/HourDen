import type { Pool } from "pg";

export type DashboardDailyBucket = {
  date: string;
  durationMinutes: number;
};

export type DashboardNamedTotal = {
  name: string;
  durationMinutes: number;
};

export type DashboardTopActivity = {
  description: string;
  projectName: string;
  clientName: string;
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
  clientBuckets: DashboardNamedTotal[];
  topActivities: DashboardTopActivity[];
};

type DashboardSummaryRow = {
  total_duration_minutes: number;
  total_billable_amount: string;
  top_project: DashboardNamedTotal | null;
  top_client: DashboardNamedTotal | null;
  daily_buckets: DashboardDailyBucket[] | null;
  client_buckets: DashboardNamedTotal[] | null;
  top_activities: DashboardTopActivity[] | null;
};

export async function getDashboardSummary(
  pool: Pool,
  workspaceId: string,
  from: string,
  to: string,
  timeZone: string,
): Promise<Omit<DashboardSummary, "from" | "to">> {
  const result = await pool.query<DashboardSummaryRow>(
    `
      WITH entries AS (
        SELECT
          GREATEST(
            0,
            ROUND(EXTRACT(EPOCH FROM (te.ended_at - te.started_at)) / 60.0)
          )::int AS duration_minutes,
          COALESCE(te.amount, 0)::numeric AS amount,
          p.name AS project_name,
          c.name AS client_name,
          te.description AS description,
          ((te.started_at AT TIME ZONE $4)::date)::text AS local_date
        FROM time_entries te
        LEFT JOIN projects p ON p.id = te.project_id
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE te.workspace_id = $1
          AND te.ended_at IS NOT NULL
          AND ((te.started_at AT TIME ZONE $4)::date >= $2::date)
          AND ((te.started_at AT TIME ZONE $4)::date <= $3::date)
      )
      SELECT
        (SELECT COALESCE(SUM(duration_minutes), 0)::int FROM entries)
          AS total_duration_minutes,
        (SELECT COALESCE(ROUND(SUM(amount), 2), 0) FROM entries)
          AS total_billable_amount,
        (
          SELECT json_build_object(
            'name', ranked.project_name,
            'durationMinutes', ranked.duration_minutes
          )
          FROM (
            SELECT
              project_name,
              SUM(duration_minutes)::int AS duration_minutes
            FROM entries
            WHERE project_name IS NOT NULL
            GROUP BY project_name
            ORDER BY duration_minutes DESC, project_name ASC
            LIMIT 1
          ) ranked
        ) AS top_project,
        (
          SELECT json_build_object(
            'name', ranked.client_name,
            'durationMinutes', ranked.duration_minutes
          )
          FROM (
            SELECT
              client_name,
              SUM(duration_minutes)::int AS duration_minutes
            FROM entries
            WHERE client_name IS NOT NULL
            GROUP BY client_name
            ORDER BY duration_minutes DESC, client_name ASC
            LIMIT 1
          ) ranked
        ) AS top_client,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'date', daily.local_date,
                'durationMinutes', daily.duration_minutes
              )
              ORDER BY daily.local_date
            ),
            '[]'::json
          )
          FROM (
            SELECT
              local_date,
              SUM(duration_minutes)::int AS duration_minutes
            FROM entries
            GROUP BY local_date
          ) daily
        ) AS daily_buckets,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'name', client_grouped.client_name,
                'durationMinutes', client_grouped.duration_minutes
              )
              ORDER BY client_grouped.duration_minutes DESC, client_grouped.client_name ASC
            ),
            '[]'::json
          )
          FROM (
            SELECT
              client_name,
              SUM(duration_minutes)::int AS duration_minutes
            FROM entries
            WHERE client_name IS NOT NULL
            GROUP BY client_name
          ) client_grouped
        ) AS client_buckets,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'description', activity_totals.description,
                'projectName', activity_totals.project_name,
                'clientName', activity_totals.client_name,
                'durationMinutes', activity_totals.duration_minutes
              )
              ORDER BY activity_totals.duration_minutes DESC, activity_totals.description ASC
            ),
            '[]'::json
          )
          FROM (
            SELECT
              totals.description,
              totals.duration_minutes,
              rep.project_name,
              rep.client_name
            FROM (
              SELECT
                description,
                SUM(duration_minutes)::int AS duration_minutes
              FROM entries
              WHERE description IS NOT NULL
                AND BTRIM(description) <> ''
              GROUP BY description
            ) totals
            INNER JOIN LATERAL (
              SELECT
                project_name,
                client_name
              FROM entries ranked
              WHERE ranked.description = totals.description
              ORDER BY ranked.duration_minutes DESC,
                ranked.project_name ASC NULLS LAST,
                ranked.client_name ASC NULLS LAST
              LIMIT 1
            ) rep ON TRUE
          ) activity_totals
        ) AS top_activities
    `,
    [workspaceId, from, to, timeZone],
  );

  const row = result.rows[0];
  const totalBillableAmount = row
    ? Number(row.total_billable_amount)
    : 0;

  return {
    totalDurationMinutes: row?.total_duration_minutes ?? 0,
    totalBillableAmount: Math.round(totalBillableAmount * 100) / 100,
    topProject: row?.top_project ?? null,
    topClient: row?.top_client ?? null,
    dailyBuckets: row?.daily_buckets ?? [],
    clientBuckets: row?.client_buckets ?? [],
    topActivities: row?.top_activities ?? [],
  };
}
