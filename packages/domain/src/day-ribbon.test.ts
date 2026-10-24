import { describe, expect, it } from "vitest";
import { layoutDayRibbon } from "./day-ribbon.js";

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
