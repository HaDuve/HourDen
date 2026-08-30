import { describe, expect, it } from "vitest";
import { isQuietInvoiceConflictMessage } from "./invoice-preview-quiet.js";

describe("isQuietInvoiceConflictMessage", () => {
  it("matches billing month conflicts", () => {
    expect(
      isQuietInvoiceConflictMessage(
        "Invoice already exists for this Client and billing month",
      ),
    ).toBe(true);
  });

  it("matches billing period conflicts", () => {
    expect(
      isQuietInvoiceConflictMessage(
        "Invoice already exists for this Client and Billing Period",
      ),
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isQuietInvoiceConflictMessage("Failed to preview invoice")).toBe(
      false,
    );
  });
});
