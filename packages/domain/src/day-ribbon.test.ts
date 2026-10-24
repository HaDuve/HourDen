import { describe, expect, it } from "vitest";
import {
  layoutDayRibbon,
  layoutDayRibbonGaps,
  normalizeDragRange,
  nudgeInstantMs,
  ribbonFractionToMs,
  snapInstantMs,
} from "./day-ribbon.js";

describe("layoutDayRibbon", () => {
  it("places blocks proportional to start/end within the auto-fitted window", () => {
    // Default window 08:00–18:00 UTC; entry 10:00–12:00 → 20% left, 20% width of 10h window
    const layout = layoutDayRibbon(
      "2026-07-02",
      [
        {
          id: "a",
          startedAt: "2026-07-02T10:00:00.000Z",
          endedAt: "2026-07-02T12:00:00.000Z",
        },
      ],
      { timeZone: "UTC" },
    );

    expect(layout.windowStartMs).toBe(Date.parse("2026-07-02T08:00:00.000Z"));
    expect(layout.windowEndMs).toBe(Date.parse("2026-07-02T18:00:00.000Z"));
    expect(layout.blocks).toHaveLength(1);
    expect(layout.blocks[0]).toMatchObject({
      id: "a",
      leftPct: 20,
      widthPct: 20,
      isRunning: false,
    });
  });

  it("expands the window to fit entries outside the default working hours", () => {
    const layout = layoutDayRibbon(
      "2026-07-02",
      [
        {
          id: "early",
          startedAt: "2026-07-02T06:00:00.000Z",
          endedAt: "2026-07-02T07:00:00.000Z",
        },
        {
          id: "late",
          startedAt: "2026-07-02T19:00:00.000Z",
          endedAt: "2026-07-02T21:00:00.000Z",
        },
      ],
      { timeZone: "UTC" },
    );

    expect(layout.windowStartMs).toBe(Date.parse("2026-07-02T06:00:00.000Z"));
    expect(layout.windowEndMs).toBe(Date.parse("2026-07-02T21:00:00.000Z"));
    expect(layout.blocks.map((b) => b.id)).toEqual(["early", "late"]);
  });

  it("clips entries that cross midnight to the day bounds", () => {
    const layout = layoutDayRibbon(
      "2026-07-02",
      [
        {
          id: "overnight",
          startedAt: "2026-07-01T22:00:00.000Z",
          endedAt: "2026-07-02T02:00:00.000Z",
        },
      ],
      { timeZone: "UTC" },
    );

    // Clipped to 00:00–02:00; window expands left to midnight (earlier than 08:00)
    expect(layout.blocks).toHaveLength(1);
    expect(layout.blocks[0]!.clippedStartMs).toBe(
      Date.parse("2026-07-02T00:00:00.000Z"),
    );
    expect(layout.blocks[0]!.clippedEndMs).toBe(
      Date.parse("2026-07-02T02:00:00.000Z"),
    );
    expect(layout.windowStartMs).toBe(Date.parse("2026-07-02T00:00:00.000Z"));
  });

  it("extends a running block to now", () => {
    const now = new Date("2026-07-02T11:30:00.000Z");
    const layout = layoutDayRibbon(
      "2026-07-02",
      [
        {
          id: "run",
          startedAt: "2026-07-02T10:00:00.000Z",
          endedAt: null,
        },
      ],
      { timeZone: "UTC", now },
    );

    expect(layout.blocks).toHaveLength(1);
    expect(layout.blocks[0]).toMatchObject({
      id: "run",
      isRunning: true,
      leftPct: 20,
      widthPct: 15, // 10:00–11:30 within 08:00–18:00 = 1.5h / 10h
    });
    expect(layout.blocks[0]!.clippedEndMs).toBe(now.getTime());
  });

  it("uses actual local day length on a DST spring-forward day", () => {
    // Europe/Berlin 2026-03-29: clocks jump 02:00 → 03:00 (23h day)
    const dayStart = Date.parse("2026-03-28T23:00:00.000Z"); // 00:00 Berlin
    const dayEnd = Date.parse("2026-03-29T22:00:00.000Z"); // 00:00 next Berlin
    expect(dayEnd - dayStart).toBe(23 * 60 * 60 * 1000);

    const layout = layoutDayRibbon(
      "2026-03-29",
      [
        {
          id: "morning",
          // 01:00–04:00 Berlin = 00:00–02:00 UTC (spans the missing hour)
          startedAt: "2026-03-29T00:00:00.000Z",
          endedAt: "2026-03-29T02:00:00.000Z",
        },
      ],
      {
        timeZone: "Europe/Berlin",
        defaultWindow: { startHour: 0, endHour: 24 },
      },
    );

    expect(layout.windowEndMs - layout.windowStartMs).toBe(
      23 * 60 * 60 * 1000,
    );
    expect(layout.blocks[0]!.widthPct).toBeCloseTo(
      (2 * 60 * 60 * 1000) / (23 * 60 * 60 * 1000) * 100,
      5,
    );
  });

  it("uses actual local day length on a DST fall-back day", () => {
    // Europe/Berlin 2026-10-25: clocks repeat 02:00–03:00 (25h day)
    const dayStart = Date.parse("2026-10-24T22:00:00.000Z");
    const dayEnd = Date.parse("2026-10-25T23:00:00.000Z");
    expect(dayEnd - dayStart).toBe(25 * 60 * 60 * 1000);

    const layout = layoutDayRibbon(
      "2026-10-25",
      [
        {
          id: "all-dayish",
          startedAt: "2026-10-24T22:00:00.000Z",
          endedAt: "2026-10-25T23:00:00.000Z",
        },
      ],
      {
        timeZone: "Europe/Berlin",
        defaultWindow: { startHour: 0, endHour: 24 },
      },
    );

    expect(layout.windowEndMs - layout.windowStartMs).toBe(
      25 * 60 * 60 * 1000,
    );
    expect(layout.blocks[0]!.leftPct).toBe(0);
    expect(layout.blocks[0]!.widthPct).toBe(100);
  });

  it("skips entries with no overlap on the day", () => {
    const layout = layoutDayRibbon(
      "2026-07-02",
      [
        {
          id: "yesterday",
          startedAt: "2026-07-01T10:00:00.000Z",
          endedAt: "2026-07-01T11:00:00.000Z",
        },
      ],
      { timeZone: "UTC" },
    );

    expect(layout.blocks).toHaveLength(0);
    expect(layout.windowStartMs).toBe(Date.parse("2026-07-02T08:00:00.000Z"));
    expect(layout.windowEndMs).toBe(Date.parse("2026-07-02T18:00:00.000Z"));
  });
});

describe("ribbon time mapping", () => {
  const windowStart = Date.parse("2026-07-02T08:00:00.000Z");
  const windowEnd = Date.parse("2026-07-02T18:00:00.000Z");

  it("maps a ribbon fraction to an instant within the window", () => {
    expect(ribbonFractionToMs(0, windowStart, windowEnd)).toBe(windowStart);
    expect(ribbonFractionToMs(1, windowStart, windowEnd)).toBe(windowEnd);
    expect(ribbonFractionToMs(0.2, windowStart, windowEnd)).toBe(
      Date.parse("2026-07-02T10:00:00.000Z"),
    );
  });

  it("clamps fractions outside 0–1", () => {
    expect(ribbonFractionToMs(-0.5, windowStart, windowEnd)).toBe(windowStart);
    expect(ribbonFractionToMs(1.5, windowStart, windowEnd)).toBe(windowEnd);
  });

  it("snaps to 5-minute boundaries by default", () => {
    expect(snapInstantMs(Date.parse("2026-07-02T10:02:00.000Z"))).toBe(
      Date.parse("2026-07-02T10:00:00.000Z"),
    );
    expect(snapInstantMs(Date.parse("2026-07-02T10:03:00.000Z"))).toBe(
      Date.parse("2026-07-02T10:05:00.000Z"),
    );
  });

  it("skips snap when disabled (Alt)", () => {
    const raw = Date.parse("2026-07-02T10:02:17.000Z");
    expect(snapInstantMs(raw, { snap: false })).toBe(raw);
  });

  it("normalizes a drag so start is before end", () => {
    expect(
      normalizeDragRange(
        Date.parse("2026-07-02T12:00:00.000Z"),
        Date.parse("2026-07-02T10:00:00.000Z"),
      ),
    ).toEqual({
      startMs: Date.parse("2026-07-02T10:00:00.000Z"),
      endMs: Date.parse("2026-07-02T12:00:00.000Z"),
    });
  });

  it("nudges an instant by the snap step", () => {
    expect(
      nudgeInstantMs(Date.parse("2026-07-02T10:00:00.000Z"), 1),
    ).toBe(Date.parse("2026-07-02T10:05:00.000Z"));
    expect(
      nudgeInstantMs(Date.parse("2026-07-02T10:00:00.000Z"), -1),
    ).toBe(Date.parse("2026-07-02T09:55:00.000Z"));
  });
});

describe("layoutDayRibbonGaps", () => {
  it("returns focusable gaps between blocks and at the window edges", () => {
    const layout = layoutDayRibbon(
      "2026-07-02",
      [
        {
          id: "a",
          startedAt: "2026-07-02T10:00:00.000Z",
          endedAt: "2026-07-02T12:00:00.000Z",
        },
        {
          id: "b",
          startedAt: "2026-07-02T14:00:00.000Z",
          endedAt: "2026-07-02T15:00:00.000Z",
        },
      ],
      { timeZone: "UTC" },
    );

    const gaps = layoutDayRibbonGaps(layout);
    expect(gaps.map((g) => ({ leftPct: g.leftPct, widthPct: g.widthPct }))).toEqual([
      { leftPct: 0, widthPct: 20 },
      { leftPct: 40, widthPct: 20 },
      { leftPct: 70, widthPct: 30 },
    ]);
  });
});
