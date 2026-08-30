const BILLING_MONTH_CONFLICT_ERROR =
  "Invoice already exists for this Client and billing month";

export function billingMonthConflictPreviewResponse(): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify({ error: BILLING_MONTH_CONFLICT_ERROR }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** First preview succeeds; later previews return billing-month conflict (post-issue re-preview). */
export function createPreviewThenBillingMonthConflictHandler(
  firstPreviewResponse: () => Response | Promise<Response>,
): (url: string, init?: RequestInit) => Promise<Response> | undefined {
  let previewCallCount = 0;
  return (url, init) => {
    if (url === "/api/invoices/preview" && init?.method === "POST") {
      previewCallCount += 1;
      if (previewCallCount === 1) {
        return Promise.resolve(firstPreviewResponse());
      }
      return billingMonthConflictPreviewResponse();
    }
    return undefined;
  };
}
