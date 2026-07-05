import type { InvoiceBlockerCode } from "@hourden/domain";

export function invoiceBlockerHref(
  code: InvoiceBlockerCode,
  context?: { clientId?: string },
): string {
  switch (code) {
    case "NO_CLIENTS":
      return "/clients?new=1";
    case "MISSING_RECIPIENT":
      return context?.clientId ? `/clients?edit=${context.clientId}` : "/clients";
    case "NO_BILLABLE_ENTRIES":
    case "ENTRIES_MISSING_DESCRIPTION":
      return "/tracker";
    case "ENTRIES_WITHOUT_PROJECT":
      return "/projects";
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

export function invoiceBlockerMessageKey(code: InvoiceBlockerCode): string {
  switch (code) {
    case "NO_CLIENTS":
      return "invoices.blockers.noClients";
    case "MISSING_RECIPIENT":
      return "invoices.blockers.missingRecipient";
    case "NO_BILLABLE_ENTRIES":
      return "invoices.blockers.noBillableEntries";
    case "ENTRIES_WITHOUT_PROJECT":
      return "invoices.blockers.entriesWithoutProject";
    case "ENTRIES_MISSING_DESCRIPTION":
      return "invoices.blockers.entriesMissingDescription";
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}
