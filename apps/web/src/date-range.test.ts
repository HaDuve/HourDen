import { describe, expect, it } from "vitest";
import {
  calendarMonthRange,
  currentMonthRange,
  isFullCalendarMonth,
  isLastMonthRange,
  isThisMonthRange,
  lastMonthRange,
  shiftMonthRange,
} from "./date-range.js";

describe("calendarMonthRange", () => {
  it("returns the first and last day of the given month", () => {
    expect(calendarMonthRange(2026, 6)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("handles February in a leap year", () => {
    expect(calendarMonthRange(2024, 2)).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });
});

describe("currentMonthRange", () => {
  it("returns the calendar month containing the reference date", () => {
    expect(currentMonthRange(new Date(2026, 5, 18))).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });
});

describe("lastMonthRange", () => {
  it("returns the previous calendar month from the reference date", () => {
    expect(lastMonthRange(new Date(2026, 5, 18))).toEqual({
      from: "2026-05-01",
      to: "2026-05-31",
    });
  });

  it("rolls back across year boundaries", () => {
    expect(lastMonthRange(new Date(2026, 0, 10))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("shiftMonthRange", () => {
  it("moves to the previous calendar month based on the current from date", () => {
    expect(
      shiftMonthRange({ from: "2026-06-01", to: "2026-06-30" }, -1),
    ).toEqual({
      from: "2026-05-01",
      to: "2026-05-31",
    });
  });

  it("moves to the next calendar month based on the current from date", () => {
    expect(
      shiftMonthRange({ from: "2026-06-15", to: "2026-06-30" }, 1),
    ).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });
});

describe("isFullCalendarMonth", () => {
  it("returns true for a complete calendar month", () => {
    expect(
      isFullCalendarMonth({ from: "2026-06-01", to: "2026-06-30" }),
    ).toBe(true);
  });

  it("returns false when the range does not start on the first", () => {
    expect(
      isFullCalendarMonth({ from: "2026-06-15", to: "2026-06-30" }),
    ).toBe(false);
  });

  it("returns false when the range does not end on the last day", () => {
    expect(
      isFullCalendarMonth({ from: "2026-06-01", to: "2026-06-29" }),
    ).toBe(false);
  });
});

describe("isThisMonthRange", () => {
  const reference = new Date(2026, 5, 18);

  it("returns true for the current calendar month", () => {
    expect(
      isThisMonthRange({ from: "2026-06-01", to: "2026-06-30" }, reference),
    ).toBe(true);
  });

  it("returns false for last month even when it is a full calendar month", () => {
    expect(
      isThisMonthRange({ from: "2026-05-01", to: "2026-05-31" }, reference),
    ).toBe(false);
  });

  it("returns false for a partial range in the current month", () => {
    expect(
      isThisMonthRange({ from: "2026-06-15", to: "2026-06-30" }, reference),
    ).toBe(false);
  });
});

describe("isLastMonthRange", () => {
  const reference = new Date(2026, 5, 18);

  it("returns true for the previous calendar month", () => {
    expect(
      isLastMonthRange({ from: "2026-05-01", to: "2026-05-31" }, reference),
    ).toBe(true);
  });

  it("returns false for the current month", () => {
    expect(
      isLastMonthRange({ from: "2026-06-01", to: "2026-06-30" }, reference),
    ).toBe(false);
  });
});
