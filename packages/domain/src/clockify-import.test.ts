import { describe, expect, it } from "vitest";
import { parseClockifyCsv } from "./clockify-import.js";

const berlin = "Europe/Berlin";

describe("parseClockifyCsv", () => {
  it("parses a Clockify Detailed CSV row into structured fields", () => {
    const csv = `"Project","Client","Description","Task","User","Group","Email","Tags","Billable","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Billable Rate (EUR)","Billable Amount (EUR)","Date of creation"
"Ondojo","Bandao","Development Call","","Hannes Duve","","hannes.duve@outlook.com","Communication","Yes","22/06/2026","10:00","22/06/2026","10:13","0:13","0.22","60.00","13.00","22/06/2026"`;

    const rows = parseClockifyCsv(csv, { timeZone: berlin });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      projectName: "Ondojo",
      clientName: "Bandao",
      description: "Development Call",
      tags: ["Communication"],
      billable: true,
      billableRate: 60,
      billableAmount: 13,
      durationMinutes: 13,
      skipped: false,
    });
    expect(rows[0]!.startedAt.toISOString()).toBe("2026-06-22T08:00:00.000Z");
    expect(rows[0]!.endedAt.toISOString()).toBe("2026-06-22T08:13:00.000Z");
  });

  it("parses the real Clockify sample fixture", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");

    const here = dirname(fileURLToPath(import.meta.url));
    const csv = await readFile(
      join(here, "../test/fixtures/clockify-sample.csv"),
      "utf8",
    );

    const rows = parseClockifyCsv(csv, { timeZone: berlin }).filter((row) => !row.skipped);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      projectName: "Coaching",
      clientName: "Hannah",
      description: "Private AI Coaching",
      billableRate: 30,
      durationMinutes: 60,
    });
    expect(rows[0]!.startedAt.toISOString()).toBe("2026-06-23T10:55:00.000Z");
    expect(rows[1]!.startedAt.toISOString()).toBe("2026-06-22T08:00:00.000Z");
    expect(rows[2]!.startedAt.toISOString()).toBe("2026-06-18T14:33:00.000Z");
  });

  it("marks rows with an empty Client as skipped", () => {
    const csv = `"Project","Client","Description","Task","User","Group","Email","Tags","Billable","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Billable Rate (EUR)","Billable Amount (EUR)","Date of creation"
"Internal","","Untracked work","","","","","","Yes","01/06/2026","9:00","01/06/2026","10:00","1:00","1.00","0.00","0.00","01/06/2026"`;

    const rows = parseClockifyCsv(csv, { timeZone: berlin });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      skipped: true,
      skipReason: "empty_client",
    });
  });
});
