import { describe, expect, it } from "vitest";
import { serializeClockifyCsv, toLocalDateKey } from "./clockify-csv.js";

const berlin = "Europe/Berlin";

const defaultOptions = {
  operatorName: "Hannes Duve",
  operatorEmail: "hannes.duve@outlook.com",
  timeZone: berlin,
};

describe("toLocalDateKey", () => {
  it("uses the operator time zone, not UTC, for calendar-day grouping", () => {
    const justAfterMidnightBerlin = new Date("2026-05-31T22:30:00.000Z");

    expect(toLocalDateKey(justAfterMidnightBerlin, berlin)).toBe("2026-06-01");
    expect(toLocalDateKey(justAfterMidnightBerlin, "UTC")).toBe("2026-05-31");
  });
});

describe("serializeClockifyCsv", () => {
  it("emits the full Clockify column set for a single entry", () => {
    const csv = serializeClockifyCsv(
      [
        {
          projectName: "Ondojo",
          clientName: "Bandao",
          description: "Development Call",
          tags: ["Communication"],
          billable: true,
          startedAt: new Date("2026-06-22T08:00:00.000Z"),
          endedAt: new Date("2026-06-22T08:13:00.000Z"),
          durationMinutes: 13,
          billableRate: 60,
          billableAmount: 13,
        },
      ],
      defaultOptions,
    );

    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      '"Project","Client","Description","Task","User","Group","Email","Tags","Billable","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Billable Rate (EUR)","Billable Amount (EUR)","Date of creation"',
    );
    expect(lines[1]).toBe(
      '"Ondojo","Bandao","Development Call","","Hannes Duve","","hannes.duve@outlook.com","Communication","Yes","22/06/2026","10:00","22/06/2026","10:13","0:13","0.22","60.00","13.00","22/06/2026"',
    );
  });

  it("matches a real Clockify export sample (golden file)", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");

    const here = dirname(fileURLToPath(import.meta.url));
    const golden = await readFile(
      join(here, "../test/fixtures/clockify-sample.csv"),
      "utf8",
    );

    const entries = [
      {
        projectName: "Coaching",
        clientName: "Hannah",
        description: "Private AI Coaching",
        tags: [] as string[],
        billable: true,
        startedAt: new Date("2026-06-23T10:55:00.000Z"),
        endedAt: new Date("2026-06-23T11:55:00.000Z"),
        durationMinutes: 60,
        billableRate: 30,
        billableAmount: 30,
      },
      {
        projectName: "Ondojo",
        clientName: "Bandao",
        description: "Development Call",
        tags: ["Communication"],
        billable: true,
        startedAt: new Date(2026, 5, 22, 10, 0),
        endedAt: new Date(2026, 5, 22, 10, 13),
        durationMinutes: 13,
        billableRate: 60,
        billableAmount: 13,
      },
      {
        projectName: "Ondojo",
        clientName: "Bandao",
        description: "App Development",
        tags: ["Development"],
        billable: true,
        startedAt: new Date("2026-06-18T14:33:00.000Z"),
        endedAt: new Date("2026-06-18T15:39:00.000Z"),
        durationMinutes: 66,
        billableRate: 60,
        billableAmount: 66,
      },
    ];

    const csv = serializeClockifyCsv(entries, defaultOptions);
    const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();
    expect(normalize(csv)).toBe(normalize(golden));
  });
});
