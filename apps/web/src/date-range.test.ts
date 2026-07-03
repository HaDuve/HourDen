import { describe, expect, it } from "vitest";
import {
  calendarMonthRange,
  currentMonthRange,
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
