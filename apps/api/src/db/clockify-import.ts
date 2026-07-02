import {
  clockifyImportFingerprint,
  parseClockifyCsv,
  type ClockifyParsedRow,
} from "@hourden/domain";
import type { Pool } from "pg";
import { reportTimeZone } from "./reports.js";

export type ClockifyImportResult = {
  imported: number;
  duplicates: number;
  skippedEmptyClient: number;
};

async function findClientByName(
  pool: Pool,
  workspaceId: string,
  name: string,
): Promise<{ id: string; default_rate: string } | null> {
  const result = await pool.query<{ id: string; default_rate: string }>(
    `
      SELECT id, default_rate
      FROM clients
      WHERE workspace_id = $1 AND name = $2
      LIMIT 1
    `,
    [workspaceId, name],
  );

  return result.rows[0] ?? null;
}

async function findProjectByClientAndName(
  pool: Pool,
  workspaceId: string,
  clientId: string,
  name: string,
): Promise<{ id: string } | null> {
  const result = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM projects
      WHERE workspace_id = $1 AND client_id = $2 AND name = $3
      LIMIT 1
    `,
    [workspaceId, clientId, name],
  );

  return result.rows[0] ?? null;
}

async function findOrCreateClient(
  pool: Pool,
  workspaceId: string,
  name: string,
  defaultRate: number,
): Promise<string> {
  const existing = await findClientByName(pool, workspaceId, name);
  if (existing) {
    return existing.id;
  }

  const created = await pool.query<{ id: string }>(
    `
      INSERT INTO clients (workspace_id, name, default_rate)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [workspaceId, name, defaultRate],
  );

  return created.rows[0]!.id;
}

async function findOrCreateProject(
  pool: Pool,
  workspaceId: string,
  clientId: string,
  name: string,
): Promise<string | null> {
  if (!name) {
    return null;
  }

  const existing = await findProjectByClientAndName(
    pool,
    workspaceId,
    clientId,
    name,
  );
  if (existing) {
    return existing.id;
  }

  const created = await pool.query<{ id: string }>(
    `
      INSERT INTO projects (workspace_id, client_id, name)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [workspaceId, clientId, name],
  );

  return created.rows[0]!.id;
}

function computeAmount(durationMinutes: number, hourlyRate: number): number {
  const hours = durationMinutes / 60;
  return Math.round(hours * hourlyRate * 100) / 100;
}

async function importRow(
  pool: Pool,
  workspaceId: string,
  row: ClockifyParsedRow,
): Promise<"imported" | "duplicate"> {
  const fingerprint = clockifyImportFingerprint(row);

  const existing = await pool.query(
    `
      SELECT id
      FROM time_entries
      WHERE workspace_id = $1 AND import_fingerprint = $2
      LIMIT 1
    `,
    [workspaceId, fingerprint],
  );

  if (existing.rows[0]) {
    return "duplicate";
  }

  const defaultRate = row.billableRate ?? 0;
  const clientId = await findOrCreateClient(
    pool,
    workspaceId,
    row.clientName,
    defaultRate,
  );
  const projectId = await findOrCreateProject(
    pool,
    workspaceId,
    clientId,
    row.projectName,
  );

  const rateResult = await pool.query<{ default_rate: string }>(
    "SELECT default_rate FROM clients WHERE id = $1",
    [clientId],
  );
  const hourlyRate = Number(rateResult.rows[0]!.default_rate);
  const amount = computeAmount(row.durationMinutes, hourlyRate);

  await pool.query(
    `
      INSERT INTO time_entries (
        workspace_id,
        project_id,
        started_at,
        ended_at,
        description,
        tags,
        billable,
        amount,
        import_fingerprint
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      workspaceId,
      projectId,
      row.startedAt,
      row.endedAt,
      row.description || null,
      row.tags,
      row.billable,
      amount,
      fingerprint,
    ],
  );

  return "imported";
}

export async function importClockifyCsv(
  pool: Pool,
  workspaceId: string,
  csv: string,
  timeZone = reportTimeZone(),
): Promise<ClockifyImportResult> {
  const rows = parseClockifyCsv(csv, { timeZone });
  const result: ClockifyImportResult = {
    imported: 0,
    duplicates: 0,
    skippedEmptyClient: 0,
  };

  for (const row of rows) {
    if (row.skipped) {
      if (row.skipReason === "empty_client") {
        result.skippedEmptyClient += 1;
      }
      continue;
    }

    const outcome = await importRow(pool, workspaceId, row);
    if (outcome === "imported") {
      result.imported += 1;
    } else {
      result.duplicates += 1;
    }
  }

  return result;
}
