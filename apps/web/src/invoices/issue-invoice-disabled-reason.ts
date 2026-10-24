export type IssueInvoiceDisabledInput = {
  previewing: boolean;
  issuing: boolean;
  loading: boolean;
  clientId: string;
  previewUrl: string | null;
  invoiceSenderConfigured: boolean;
  invoiceNumberExists: boolean;
  invoiceNumberEdited: boolean;
  numberingStrategy: string | null;
};

/**
 * Human-readable reason the Issue Invoice control is disabled, or null when
 * the control should be enabled. Priority matches operator-actionable blockers
 * first, then transient load/preview states.
 */
export function issueInvoiceDisabledReason(
  input: IssueInvoiceDisabledInput,
  t: (key: string) => string,
): string | null {
  if (!input.clientId) {
    return t("invoices.selectClientBeforeIssue");
  }
  if (!input.invoiceSenderConfigured) {
    return t("invoices.setupInvoiceSenderBeforeIssue");
  }
  if (input.invoiceNumberExists) {
    return t("invoices.invoiceNumberExists");
  }
  if (input.invoiceNumberEdited && !input.numberingStrategy) {
    return t("invoices.chooseNumberingStrategy");
  }
  if (input.issuing) {
    return t("invoices.issuing");
  }
  if (input.previewing || input.loading) {
    return t("invoices.previewing");
  }
  if (!input.previewUrl) {
    return t("invoices.previewBeforeIssue");
  }
  return null;
}
