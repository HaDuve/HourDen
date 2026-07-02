import { describe, expect, it } from "vitest";
import {
  buildClientReport,
  groupEntriesByDateAndDescription,
} from "./report.js";

describe("groupEntriesByDateAndDescription", () => {
  it("merges entries on the same date and description, summing duration and amount", () => {
    const result = groupEntriesByDateAndDescription([
      {
        date: "2026-06-18",
        description: "App Development",
        durationMinutes: 66,
        amount: 66,
      },
      {
        date: "2026-06-18",
        description: "App Development",
        durationMinutes: 8,
        amount: 8,
      },
      {
        date: "2026-06-18",
        description: "Development Call",
        durationMinutes: 13,
        amount: 13,
      },
    ]);

    expect(result).toEqual([
      {
        date: "2026-06-18",
        description: "App Development",
        durationMinutes: 74,
        amount: 74,
      },
      {
        date: "2026-06-18",
        description: "Development Call",
        durationMinutes: 13,
        amount: 13,
      },
    ]);
  });
});

describe("buildClientReport", () => {
  it("groups entries by Client with per-client totals and date+description lines", () => {
    const result = buildClientReport([
      {
        clientName: "Bandao",
        date: "2026-06-18",
        description: "App Development",
        durationMinutes: 66,
        amount: 66,
      },
      {
        clientName: "Bandao",
        date: "2026-06-18",
        description: "App Development",
        durationMinutes: 8,
        amount: 8,
      },
      {
        clientName: "Hannah",
        date: "2026-06-23",
        description: "Private AI Coaching",
        durationMinutes: 60,
        amount: 30,
      },
    ]);

    expect(result).toEqual([
      {
        clientName: "Bandao",
        lines: [
          {
            date: "2026-06-18",
            description: "App Development",
            durationMinutes: 74,
            amount: 74,
          },
        ],
        totalDurationMinutes: 74,
        totalAmount: 74,
      },
      {
        clientName: "Hannah",
        lines: [
          {
            date: "2026-06-23",
            description: "Private AI Coaching",
            durationMinutes: 60,
            amount: 30,
          },
        ],
        totalDurationMinutes: 60,
        totalAmount: 30,
      },
    ]);
  });
});
