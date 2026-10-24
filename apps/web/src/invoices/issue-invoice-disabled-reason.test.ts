import { describe, expect, it } from "vitest";
import { issueInvoiceDisabledReason } from "./issue-invoice-disabled-reason.js";

const ready = {
  previewing: false,
  issuing: false,
  loading: false,
  clientId: "client-1",
  previewUrl: "blob:preview",
  invoiceSenderConfigured: true,
  invoiceNumberExists: false,
  invoiceNumberEdited: false,
  numberingStrategy: null as string | null,
};

const t = (key: string) => key;

describe("issueInvoiceDisabledReason", () => {
  it("returns null when Issue Invoice can proceed", () => {
    expect(issueInvoiceDisabledReason(ready, t)).toBeNull();
  });

  it("surfaces Invoice Sender setup before other blockers", () => {
    expect(
      issueInvoiceDisabledReason(
        { ...ready, invoiceSenderConfigured: false, invoiceNumberExists: true },
        t,
      ),
    ).toBe("invoices.setupInvoiceSenderBeforeIssue");
  });

  it("surfaces an existing Invoice Number as the disable reason", () => {
    expect(
      issueInvoiceDisabledReason({ ...ready, invoiceNumberExists: true }, t),
    ).toBe("invoices.invoiceNumberExists");
  });

  it("asks for a numbering strategy after the number was edited", () => {
    expect(
      issueInvoiceDisabledReason(
        { ...ready, invoiceNumberEdited: true, numberingStrategy: null },
        t,
      ),
    ).toBe("invoices.chooseNumberingStrategy");
  });

  it("asks for a preview when none is ready", () => {
    expect(
      issueInvoiceDisabledReason({ ...ready, previewUrl: null }, t),
    ).toBe("invoices.previewBeforeIssue");
  });
});
