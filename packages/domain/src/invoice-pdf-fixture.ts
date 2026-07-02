import {
  DEFAULT_INVOICE_OPERATOR,
  type GenerateInvoicePdfInput,
} from "./invoice-pdf.js";

export const bandaoInvoiceFixture: GenerateInvoicePdfInput = {
  invoiceNumber: "2026006",
  invoiceDate: "2026-06-30",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  dueDate: "2026-07-14",
  recipient: {
    legalName: "BANDAO Guidance GmbH",
    addressLine1: "Schloßbergstraße 1",
    addressLine2: "82319 Starnberg",
  },
  lines: [
    {
      date: "2026-06-01",
      description: "Development Call",
      durationMinutes: 75,
      amount: 75,
    },
    {
      date: "2026-06-03",
      description: "App Development",
      durationMinutes: 129,
      amount: 129,
    },
  ],
  operator: DEFAULT_INVOICE_OPERATOR,
};
