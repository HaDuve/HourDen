import { describe, expect, it } from "vitest";
import { createPreviewThenBillingMonthConflictHandler } from "./invoices-page-preview-fetch.js";

describe("createPreviewThenBillingMonthConflictHandler", () => {
  it("returns a PDF preview on the first call and billing-month conflict afterward", async () => {
    const handler = createPreviewThenBillingMonthConflictHandler(() =>
      new Response("%PDF", { status: 200 }),
    );

    const first = await handler("/api/invoices/preview", { method: "POST" });
    expect(first?.ok).toBe(true);

    const second = await handler("/api/invoices/preview", { method: "POST" });
    expect(second?.status).toBe(409);
    expect(await second?.json()).toEqual({
      error: "Invoice already exists for this Client and billing month",
    });
  });
});
