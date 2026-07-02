import { describe, expect, it } from "vitest";
import { nextInvoiceNumber } from "./invoice-number.js";

describe("nextInvoiceNumber", () => {
  it("returns YYYY001 when no invoices exist for the year", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("2026001");
  });

  it("increments the sequence for the same Recipient year", () => {
    expect(nextInvoiceNumber(["2026001", "2026002"], 2026)).toBe("2026003");
  });

  it("ignores invoice numbers from other years", () => {
    expect(nextInvoiceNumber(["2025003"], 2026)).toBe("2026001");
  });
});
