import { Hono } from "hono";
import type { Pool } from "pg";
import { importClockifyCsv } from "./db/clockify-import.js";
import { getWorkspaceCalendarTimezone } from "./db/workspaces.js";
import { getCurrentWorkspaceId } from "./workspace.js";

function isReadableUpload(value: unknown): value is { text(): Promise<string> } {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { text?: unknown }).text === "function"
  );
}

async function readUploadText(file: unknown): Promise<string | null> {
  if (typeof file === "string") {
    return file;
  }

  if (isReadableUpload(file)) {
    return file.text();
  }

  if (
    file !== null &&
    typeof file === "object" &&
    typeof (file as { arrayBuffer?: unknown }).arrayBuffer === "function"
  ) {
    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    return buffer.toString("utf8");
  }

  return null;
}

export function createImportRouter(pool: Pool) {
  const router = new Hono();

  router.post("/clockify", async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    const csv = await readUploadText(file);

    if (csv === null) {
      return c.json({ error: "file is required" }, 400);
    }

    const workspaceId = getCurrentWorkspaceId();
    const timeZone = await getWorkspaceCalendarTimezone(pool, workspaceId);
    const result = await importClockifyCsv(pool, workspaceId, csv, timeZone);

    return c.json(result);
  });

  return router;
}
