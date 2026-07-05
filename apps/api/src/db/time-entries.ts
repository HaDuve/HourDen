import type {
  CreateManualEntryInput,
  StartTimerInput,
  StopTimerInput,
  TimeEntry,
  UpdateTimeEntryInput,
} from "@hourden/domain";
import type { Pool } from "pg";

type TimeEntryRow = {
  id: string;
  project_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  description: string | null;
  tags: string[];
  billable: boolean;
  amount: string | null;
  invoice_id: string | null;
};

function durationMinutes(startedAt: Date, endedAt: Date | null, now = new Date()): number {
  const end = endedAt ?? now;
  return Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 60_000));
}

function isBillableComplete(row: TimeEntryRow): boolean {
  return row.ended_at !== null && Boolean(row.description?.trim());
}

function rowToTimeEntry(row: TimeEntryRow, now = new Date()): TimeEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString() ?? null,
    description: row.description,
    tags: row.tags ?? [],
    billable: row.billable,
    amount: row.amount !== null ? Number(row.amount) : null,
    billableComplete: isBillableComplete(row),
    isRunning: row.ended_at === null,
    durationMinutes: durationMinutes(row.started_at, row.ended_at, now),
    invoiced: row.invoice_id !== null,
  };
}

async function getClientRateForProject(
  pool: Pool,
  workspaceId: string,
  projectId: string | null,
): Promise<number | null> {
  if (!projectId) return null;

  const result = await pool.query<{ default_rate: string }>(
    `
      SELECT c.default_rate
      FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.id = $1 AND p.workspace_id = $2
    `,
    [projectId, workspaceId],
  );

  return result.rows[0] ? Number(result.rows[0].default_rate) : null;
}

function computeAmount(durationMins: number, hourlyRate: number): number {
  const hours = durationMins / 60;
  return Math.round(hours * hourlyRate * 100) / 100;
}

async function computeStoredAmount(
  pool: Pool,
  workspaceId: string,
  row: TimeEntryRow,
): Promise<number | null> {
  if (!row.ended_at) return null;

  const rate = await getClientRateForProject(pool, workspaceId, row.project_id);
  if (rate === null) return null;

  const mins = durationMinutes(row.started_at, row.ended_at);
  return computeAmount(mins, rate);
}

async function isProjectInWorkspace(
  pool: Pool,
  workspaceId: string,
  projectId: string,
): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM projects WHERE id = $1 AND workspace_id = $2",
    [projectId, workspaceId],
  );
  return Boolean(result.rows[0]);
}

async function validateProjectId(
  pool: Pool,
  workspaceId: string,
  projectId: string | null | undefined,
): Promise<"ok" | "invalid_project"> {
  if (!projectId) return "ok";
  return (await isProjectInWorkspace(pool, workspaceId, projectId))
    ? "ok"
    : "invalid_project";
}

async function getTimeEntryRow(
  pool: Pool,
  workspaceId: string,
  entryId: string,
): Promise<TimeEntryRow | null> {
  const result = await pool.query<TimeEntryRow>(
    `
      SELECT
        id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        invoice_id
      FROM time_entries
      WHERE id = $1 AND workspace_id = $2
    `,
    [entryId, workspaceId],
  );

  return result.rows[0] ?? null;
}

export async function startTimer(
  pool: Pool,
  workspaceId: string,
  input: StartTimerInput,
): Promise<TimeEntry | "invalid_project"> {
  const projectCheck = await validateProjectId(pool, workspaceId, input.projectId);
  if (projectCheck === "invalid_project") return "invalid_project";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const running = await client.query<TimeEntryRow>(
      `
        SELECT
          id,
          project_id,
          started_at,
          ended_at,
          description,
          tags,
          billable,
          amount,
          invoice_id
        FROM time_entries
        WHERE workspace_id = $1 AND ended_at IS NULL
        FOR UPDATE
      `,
      [workspaceId],
    );

    if (running.rows[0]) {
      const current = running.rows[0];
      const stopped = await client.query<TimeEntryRow>(
        `
          UPDATE time_entries
          SET ended_at = now(), updated_at = now()
          WHERE id = $1 AND workspace_id = $2
          RETURNING
            id,
            project_id,
            started_at,
            ended_at,
            description,
            tags,
            billable,
            amount,
            invoice_id
        `,
        [current.id, workspaceId],
      );
      const stoppedRow = stopped.rows[0]!;
      const amount = await computeStoredAmount(pool, workspaceId, stoppedRow);
      await client.query(
        `
          UPDATE time_entries
          SET amount = $3, updated_at = now()
          WHERE id = $1 AND workspace_id = $2
        `,
        [current.id, workspaceId, amount],
      );
    }

    const result = await client.query<TimeEntryRow>(
      `
        INSERT INTO time_entries (
          workspace_id,
          project_id,
          started_at,
          description
        )
        VALUES ($1, $2, now(), $3)
        RETURNING
          id,
          project_id,
          started_at,
          ended_at,
          description,
          tags,
          billable,
          amount,
          invoice_id
      `,
      [
        workspaceId,
        input.projectId ?? null,
        input.description?.trim() || null,
      ],
    );

    await client.query("COMMIT");
    return rowToTimeEntry(result.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRunningTimer(
  pool: Pool,
  workspaceId: string,
): Promise<TimeEntry | null> {
  const result = await pool.query<TimeEntryRow>(
    `
      SELECT
        id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        invoice_id
      FROM time_entries
      WHERE workspace_id = $1 AND ended_at IS NULL
      LIMIT 1
    `,
    [workspaceId],
  );

  return result.rows[0] ? rowToTimeEntry(result.rows[0]) : null;
}

export async function stopTimer(
  pool: Pool,
  workspaceId: string,
  entryId: string,
  input: StopTimerInput,
): Promise<TimeEntry | "not_found" | "not_running"> {
  const row = await getTimeEntryRow(pool, workspaceId, entryId);
  if (!row) return "not_found";
  if (row.ended_at) return "not_running";

  const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
  const description =
    input.description !== undefined
      ? input.description?.trim() || null
      : row.description;

  const updatedRow: TimeEntryRow = {
    ...row,
    ended_at: endedAt,
    description,
  };
  const amount = await computeStoredAmount(pool, workspaceId, updatedRow);

  const result = await pool.query<TimeEntryRow>(
    `
      UPDATE time_entries
      SET
        ended_at = $3,
        description = $4,
        amount = $5,
        updated_at = now()
      WHERE id = $1 AND workspace_id = $2 AND ended_at IS NULL
      RETURNING
        id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        invoice_id
    `,
    [entryId, workspaceId, endedAt, description, amount],
  );

  if (!result.rows[0]) return "not_running";
  return rowToTimeEntry(result.rows[0]);
}

export async function createManualEntry(
  pool: Pool,
  workspaceId: string,
  input: CreateManualEntryInput,
): Promise<TimeEntry | "invalid_range" | "invalid_project"> {
  const projectCheck = await validateProjectId(pool, workspaceId, input.projectId);
  if (projectCheck === "invalid_project") return "invalid_project";

  const startedAt = new Date(input.startedAt);
  const endedAt = new Date(input.endedAt);

  if (endedAt <= startedAt) {
    return "invalid_range";
  }

  const row: TimeEntryRow = {
    id: "",
    project_id: input.projectId ?? null,
    started_at: startedAt,
    ended_at: endedAt,
    description: input.description?.trim() || null,
    tags: input.tags ?? [],
    billable: input.billable ?? true,
    amount: null,
    invoice_id: null,
  };
  const amount = await computeStoredAmount(pool, workspaceId, row);

  const result = await pool.query<TimeEntryRow>(
    `
      INSERT INTO time_entries (
        workspace_id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        invoice_id
    `,
    [
      workspaceId,
      input.projectId ?? null,
      startedAt,
      endedAt,
      input.description?.trim() || null,
      input.tags ?? [],
      input.billable ?? true,
      amount,
    ],
  );

  return rowToTimeEntry(result.rows[0]!);
}

export async function listTrackerTimeEntries(
  pool: Pool,
  workspaceId: string,
  limit: number,
): Promise<TimeEntry[]> {
  const result = await pool.query<TimeEntryRow>(
    `
      SELECT
        id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        invoice_id
      FROM time_entries
      WHERE workspace_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `,
    [workspaceId, limit],
  );

  return result.rows.map((row) => rowToTimeEntry(row));
}

export async function listTimeEntriesForDate(
  pool: Pool,
  workspaceId: string,
  date: string,
  timeZone: string,
): Promise<TimeEntry[]> {
  const result = await pool.query<TimeEntryRow>(
    `
      SELECT
        id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        invoice_id
      FROM time_entries
      WHERE workspace_id = $1
        AND ((started_at AT TIME ZONE $3)::date <= $2::date)
        AND (ended_at IS NULL OR (ended_at AT TIME ZONE $3)::date >= $2::date)
      ORDER BY started_at ASC
    `,
    [workspaceId, date, timeZone],
  );

  return result.rows.map((row) => rowToTimeEntry(row));
}

export async function updateTimeEntry(
  pool: Pool,
  workspaceId: string,
  entryId: string,
  input: UpdateTimeEntryInput,
): Promise<TimeEntry | null | "invoiced" | "invalid_project" | "cannot_reopen"> {
  const existing = await getTimeEntryRow(pool, workspaceId, entryId);
  if (!existing) return null;
  if (existing.invoice_id) return "invoiced";

  if (input.projectId) {
    const projectCheck = await validateProjectId(pool, workspaceId, input.projectId);
    if (projectCheck === "invalid_project") return "invalid_project";
  }

  if (input.endedAt === null && existing.ended_at !== null) {
    return "cannot_reopen";
  }

  const assignments: string[] = [];
  const values: unknown[] = [entryId, workspaceId];

  const addField = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (input.projectId !== undefined) addField("project_id", input.projectId);
  if (input.startedAt !== undefined) addField("started_at", new Date(input.startedAt));
  if (input.endedAt !== undefined) {
    addField("ended_at", input.endedAt ? new Date(input.endedAt) : null);
  }
  if (input.description !== undefined) {
    addField("description", input.description?.trim() || null);
  }
  if (input.tags !== undefined) addField("tags", input.tags);
  if (input.billable !== undefined) addField("billable", input.billable);

  if (assignments.length === 0) {
    return rowToTimeEntry(existing);
  }

  assignments.push("updated_at = now()");

  const result = await pool.query<TimeEntryRow>(
    `
      UPDATE time_entries
      SET ${assignments.join(", ")}
      WHERE id = $1 AND workspace_id = $2 AND invoice_id IS NULL
      RETURNING
        id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        invoice_id
    `,
    values,
  );

  if (!result.rows[0]) return null;

  const updated = result.rows[0];
  if (updated.ended_at) {
    const amount = await computeStoredAmount(pool, workspaceId, updated);
    const withAmount = await pool.query<TimeEntryRow>(
      `
        UPDATE time_entries
        SET amount = $3, updated_at = now()
        WHERE id = $1 AND workspace_id = $2
        RETURNING
          id,
          project_id,
          started_at,
          ended_at,
          description,
          tags,
          billable,
          amount,
          invoice_id
      `,
      [entryId, workspaceId, amount],
    );
    return rowToTimeEntry(withAmount.rows[0]!);
  }

  return rowToTimeEntry(updated);
}

export async function deleteTimeEntry(
  pool: Pool,
  workspaceId: string,
  entryId: string,
): Promise<"deleted" | "not_found" | "invoiced"> {
  const existing = await getTimeEntryRow(pool, workspaceId, entryId);
  if (!existing) return "not_found";
  if (existing.invoice_id) return "invoiced";

  await pool.query(
    "DELETE FROM time_entries WHERE id = $1 AND workspace_id = $2",
    [entryId, workspaceId],
  );
  return "deleted";
}
