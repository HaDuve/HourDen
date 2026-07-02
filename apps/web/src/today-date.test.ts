import { describe, expect, it } from "vitest";
import { todayLocalDate } from "./today-date.js";

describe("todayLocalDate", () => {
  it("uses the local calendar day, not UTC", () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    expect(todayLocalDate()).toBe(expected);
  });
});
