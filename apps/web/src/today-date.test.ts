import { describe, expect, it } from "vitest";
import { todayDateInTimeZone, todayLocalDate } from "./today-date.js";

describe("todayLocalDate", () => {
  it("uses the local calendar day, not UTC", () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    expect(todayLocalDate()).toBe(expected);
  });
});

describe("todayDateInTimeZone", () => {
  it("returns the calendar day in the given IANA timezone", () => {
    const instant = new Date("2026-05-31T22:30:00.000Z");

    expect(todayDateInTimeZone("Europe/Berlin", instant)).toBe("2026-06-01");
    expect(todayDateInTimeZone("UTC", instant)).toBe("2026-05-31");
  });
});
