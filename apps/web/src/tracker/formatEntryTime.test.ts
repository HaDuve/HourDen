import { describe, expect, it } from "vitest";
import { formatEntryTime } from "./formatEntryTime.js";

describe("formatEntryTime", () => {
  it("formats time only — hides the date string", () => {
    const iso = new Date(2026, 6, 2, 8, 30).toISOString();

    const en = formatEntryTime(iso, "en");
    const de = formatEntryTime(iso, "de");

    expect(en).toMatch(/8:30/);
    expect(de).toMatch(/08:30|8:30/);
    expect(en).not.toMatch(/Jul|July|2026/);
    expect(de).not.toMatch(/Juli|Jul|2026/);
  });
});
