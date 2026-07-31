import { describe, expect, it } from "vitest";
import { invoiceFilename } from "./invoice-path.js";

describe("invoiceFilename", () => {
  it("builds rechnungsnummer_date_Invoice_sender_client.pdf from periodEnd and Invoice Sender", () => {
    expect(
      invoiceFilename({
        invoiceNumber: "2026001",
        periodEnd: "2026-01-31",
        senderName: "Hannes Duve",
        clientName: "BANDAO",
      }),
    ).toBe("2026001_31_01_26_Invoice_Hannes_Duve_BANDAO.pdf");
  });
});
