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

  it("keeps Client name casing as-is", () => {
    expect(
      invoiceFilename({
        invoiceNumber: "2026001",
        periodEnd: "2026-01-31",
        senderName: "Hannes Duve",
        clientName: "Bandao",
      }),
    ).toBe("2026001_31_01_26_Invoice_Hannes_Duve_Bandao.pdf");
  });

  it("replaces quotes and path separators in sender and Client segments", () => {
    expect(
      invoiceFilename({
        invoiceNumber: "2026002",
        periodEnd: "2026-02-28",
        senderName: 'Han/nes "Duve"',
        clientName: 'Ban"dao/Corp',
      }),
    ).toBe("2026002_28_02_26_Invoice_Han_nes__Duve__Ban_dao_Corp.pdf");
  });
});
