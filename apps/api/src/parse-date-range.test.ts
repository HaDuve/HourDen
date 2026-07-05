import { describe, expect, it } from "vitest";
import { parseDateRange } from "./parse-date-range.js";

describe("parseDateRange", () => {
  it("accepts a valid inclusive range", () => {
    expect(parseDateRange("2026-06-01", "2026-06-30")).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("rejects a reversed range", () => {
    expect(parseDateRange("2026-06-30", "2026-06-01")).toBe("invalid");
  });

  it("rejects missing or malformed dates", () => {
    expect(parseDateRange(undefined, "2026-06-30")).toBe("invalid");
    expect(parseDateRange("2026-06-01", "06-30-2026")).toBe("invalid");
  });
});
