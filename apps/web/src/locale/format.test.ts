import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "./format.js";

describe("locale formatting", () => {
  const sampleDate = new Date("2026-07-04T12:00:00.000Z");
  const sampleAmount = 1234.56;

  it("formats currency and dates for en", () => {
    expect(formatCurrency(sampleAmount, "en")).toBe("€1,234.56");
    expect(formatDate(sampleDate, "en")).toBe("07/04/2026");
  });

  it("formats currency and dates for de", () => {
    expect(formatCurrency(sampleAmount, "de")).toBe("1.234,56 €");
    expect(formatDate(sampleDate, "de")).toBe("04.07.2026");
  });

  it("switches currency output by active locale", () => {
    expect(formatCurrency(sampleAmount, "en")).toBe("€1,234.56");
    expect(formatCurrency(sampleAmount, "de")).toBe("1.234,56 €");
  });
});
