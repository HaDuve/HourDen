export const INVOICE_BLOCKER_CODES = [
  "NO_CLIENTS",
  "MISSING_RECIPIENT",
  "NO_BILLABLE_ENTRIES",
  "ENTRIES_WITHOUT_PROJECT",
  "ENTRIES_MISSING_DESCRIPTION",
] as const;

export type InvoiceBlockerCode = (typeof INVOICE_BLOCKER_CODES)[number];

export type InvoiceBlockerResponse = {
  error: string;
  code: InvoiceBlockerCode;
};
