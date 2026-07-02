import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";

const databaseUrl = process.env.DATABASE_URL;

async function readFixture(name: string): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFile(join(here, "../../../packages/domain/test/fixtures", name), "utf8");
}

describe.skipIf(!databaseUrl)("Clockify import API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    await pool.end();
  });

  async function importCsv(csv: string) {
    const form = new FormData();
    form.append("file", new File([csv], "clockify.csv", { type: "text/csv" }));

    return app.request("/api/import/clockify", {
      method: "POST",
      body: form,
    });
  }

  it("imports Clockify rows as Time Entries and creates Clients and Projects", async () => {
    const csv = await readFixture("clockify-sample.csv");
    const res = await importCsv(csv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      imported: 3,
      skippedEmptyClient: 0,
      duplicates: 0,
    });

    const { clients } = await (await app.request("/api/clients")).json();
    expect(clients.map((client: { name: string }) => client.name).sort()).toEqual([
      "Bandao",
      "Hannah",
    ]);

    const hannah = clients.find((client: { name: string }) => client.name === "Hannah");
    expect(hannah.defaultRate).toBe(30);

    const { projects } = await (await app.request("/api/projects")).json();
    expect(projects.map((project: { name: string }) => project.name).sort()).toEqual([
      "Coaching",
      "Ondojo",
    ]);

    const entries = await (
      await app.request("/api/time-entries?date=2026-06-22")
    ).json();
    expect(entries.entries).toHaveLength(1);
    expect(entries.entries[0]).toMatchObject({
      description: "Development Call",
      billableComplete: true,
      amount: 13,
    });
  });

  it("does not duplicate entries when the same file is imported again", async () => {
    const csv = await readFixture("clockify-sample.csv");

    const first = await importCsv(csv);
    expect(first.status).toBe(200);
    expect((await first.json()).imported).toBe(3);

    const second = await importCsv(csv);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      imported: 0,
      duplicates: 3,
      skippedEmptyClient: 0,
    });

    const count = await pool.query("SELECT count(*)::int AS count FROM time_entries");
    expect(count.rows[0]?.count).toBe(3);
  });

  it("imports rows that share times and description but differ by tags", async () => {
    const csv = `"Project","Client","Description","Task","User","Group","Email","Tags","Billable","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Billable Rate (EUR)","Billable Amount (EUR)","Date of creation"
"Ondojo","Bandao","Development Call","","","","","Communication","Yes","22/06/2026","10:00","22/06/2026","10:13","0:13","0.22","60.00","13.00","22/06/2026"
"Ondojo","Bandao","Development Call","","","","","Development","Yes","22/06/2026","10:00","22/06/2026","10:13","0:13","0.22","60.00","13.00","22/06/2026"`;

    const res = await importCsv(csv);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      imported: 2,
      duplicates: 0,
      skippedEmptyClient: 0,
    });
  });

  it("reports rows with empty Client as skipped", async () => {
    const csv = `"Project","Client","Description","Task","User","Group","Email","Tags","Billable","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Billable Rate (EUR)","Billable Amount (EUR)","Date of creation"
"Internal","","Untracked work","","","","","","Yes","01/06/2026","9:00","01/06/2026","10:00","1:00","1.00","0.00","0.00","01/06/2026"
"Ondojo","Bandao","Development Call","","","","","","Yes","22/06/2026","10:00","22/06/2026","10:13","0:13","0.22","60.00","13.00","22/06/2026"`;

    const res = await importCsv(csv);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      imported: 1,
      skippedEmptyClient: 1,
      duplicates: 0,
    });
  });
});
