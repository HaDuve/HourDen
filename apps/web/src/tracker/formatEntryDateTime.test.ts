import { describe, expect, it } from "vitest";
import { formatEntryDateTime } from "./formatEntryDateTime.js";

describe("formatEntryDateTime", () => {
  it("formats time only — hides the date string", () => {
    const iso = new Date(2026, 6, 2, 8, 30).toISOString();

    const en = formatEntryDateTime(iso, "en");
    const de = formatEntryDateTime(iso, "de");

    expect(en).not.toMatch(/Jul|July|2026/);
    expect(de).not.toMatch(/Juli|Jul|2026/);
    expect(en).toMatch(/8:30/);
    expect(de).toMatch(/08:30|8:30/);
  });
});
