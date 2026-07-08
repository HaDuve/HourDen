import type { InvoiceLine, InvoiceOperator, InvoiceRecipient } from "./invoice-pdf.js";

export type InvoiceIssuanceSnapshot = {
  recipient: InvoiceRecipient;
  operator: InvoiceOperator;
  lines: InvoiceLine[];
  totals: {
    totalAmount: number;
    totalDurationMinutes: number;
  };
  usesSmallBusinessRule?: boolean;
};
