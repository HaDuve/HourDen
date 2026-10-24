import { describe, expect, it } from "vitest";
import {
  computeLiveEarnings,
  summarizeUnbilledMonth,
} from "./money-clock.js";

describe("computeLiveEarnings", () => {
  it("returns elapsed seconds × hourly rate, rounded like invoice amounts", () => {
    // 0:49:13 at €85/h → 2953/3600 × 85 = 69.722… → €69.72
    expect(computeLiveEarnings(2953, 85)).toBe(69.72);
  });

  it("returns 0 when there is no elapsed time or no rate", () => {
    expect(computeLiveEarnings(0, 85)).toBe(0);
    expect(computeLiveEarnings(3600, 0)).toBe(0);
  });

  it("rounds half-cents the same way as stored invoice amounts", () => {
    // 1 second at €0.01/h is negligible; 30 minutes at €100/h = €50.00
    expect(computeLiveEarnings(1800, 100)).toBe(50);
  });
});

describe("summarizeUnbilledMonth", () => {
  const timeZone = "Europe/Berlin";
  const monthKey = "2026-10";

  it("sums Billable Complete, not-yet-invoiced amounts in the month", () => {
    const summary = summarizeUnbilledMonth(
      [
        {
          startedAt: "2026-10-05T10:00:00.000Z",
          endedAt: "2026-10-05T11:00:00.000Z",
          amount: 85,
          billableComplete: true,
          invoiced: false,
        },
        {
          startedAt: "2026-10-12T10:00:00.000Z",
          endedAt: "2026-10-12T11:30:00.000Z",
          amount: 127.5,
          billableComplete: true,
          invoiced: false,
        },
        {
          startedAt: "2026-10-20T10:00:00.000Z",
          endedAt: "2026-10-20T11:00:00.000Z",
          amount: 85,
          billableComplete: true,
          invoiced: true,
        },
        {
          // Still September in Europe/Berlin (UTC+2 in late Sep)
          startedAt: "2026-09-15T10:00:00.000Z",
          endedAt: "2026-09-15T11:00:00.000Z",
          amount: 85,
          billableComplete: true,
          invoiced: false,
        },
      ],
      { monthKey, timeZone },
    );

    expect(summary).toEqual({ totalAmount: 212.5, incompleteCount: 0 });
  });

  it("counts stopped incomplete entries that would be excluded from invoicing", () => {
    const summary = summarizeUnbilledMonth(
      [
        {
          startedAt: "2026-10-05T10:00:00.000Z",
          endedAt: "2026-10-05T11:00:00.000Z",
          amount: 85,
          billableComplete: true,
          invoiced: false,
        },
        {
          startedAt: "2026-10-06T10:00:00.000Z",
          endedAt: "2026-10-06T11:00:00.000Z",
          amount: null,
          billableComplete: false,
          invoiced: false,
        },
        {
          startedAt: "2026-10-07T10:00:00.000Z",
          endedAt: null,
          amount: null,
          billableComplete: false,
          invoiced: false,
        },
      ],
      { monthKey, timeZone },
    );

    expect(summary).toEqual({ totalAmount: 85, incompleteCount: 1 });
  });

  it("uses Workspace Calendar Timezone for month membership", () => {
    // 2026-09-30 22:30 UTC = 2026-10-01 00:30 in Europe/Berlin
    const summary = summarizeUnbilledMonth(
      [
        {
          startedAt: "2026-09-30T22:30:00.000Z",
          endedAt: "2026-09-30T23:30:00.000Z",
          amount: 40,
          billableComplete: true,
          invoiced: false,
        },
      ],
      { monthKey: "2026-10", timeZone: "Europe/Berlin" },
    );

    expect(summary.totalAmount).toBe(40);
  });
});
