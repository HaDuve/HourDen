/** Billing-period conflicts shown quietly in the preview pane, not as loud alerts. */
export function isQuietInvoiceConflictMessage(message: string): boolean {
  return (
    /already exists for this client and billing month/i.test(message) ||
    /already exists for this client and billing period/i.test(message)
  );
}
