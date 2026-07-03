import { describe, expect, it } from "vitest";
import {
  invoiceNumberExists,
  nextInvoiceNumber,
  previewNextInvoiceNumbers,
} from "./invoice-number.js";

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

  it("continues from the highest issued suffix when strategy is from_last", () => {
    expect(
      nextInvoiceNumber(["2026001", "2026010"], 2026, "from_last"),
    ).toBe("2026011");
  });

  it("keeps count-based sequencing when strategy is sequential", () => {
    expect(
      nextInvoiceNumber(["2026010"], 2026, "sequential"),
    ).toBe("2026002");
  });
});

describe("previewNextInvoiceNumbers", () => {
  it("shows both future numbering options after issuing an edited number", () => {
    expect(
      previewNextInvoiceNumbers([], 2026, "2026010"),
    ).toEqual({
      sequential: "2026002",
      fromLast: "2026011",
    });
  });
});

describe("invoiceNumberExists", () => {
  it("returns true when the number is already issued for the Client", () => {
    expect(invoiceNumberExists(["2026001"], "2026001")).toBe(true);
    expect(invoiceNumberExists(["2026001"], "2026002")).toBe(false);
  });
});
