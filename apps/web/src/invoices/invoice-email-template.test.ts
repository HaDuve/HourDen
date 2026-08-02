import { describe, expect, it } from "vitest";
import {
  fillInvoiceEmailTemplate,
  invoiceEmailPlaceholderVars,
} from "./invoice-email-template.js";

describe("invoice email template", () => {
  it("fills a German month-based subject and body like a typical prepare-email draft", () => {
    const vars = invoiceEmailPlaceholderVars({
      greetingName: "Birgit",
      invoiceNumber: "BAN2026006",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      operatorName: "Hannes",
      locale: "de",
    });

    const subject = fillInvoiceEmailTemplate(
      "Rechnung {{billingMonth}}",
      vars,
    );
    const body = fillInvoiceEmailTemplate(
      "Hallo {{greetingName}},\n\nanbei findest du die Rechnung für {{billingMonth}}.\n\nLiebe Grüße und einen sonnigen Tag,\n{{operatorName}}",
      vars,
    );

    expect(subject).toBe("Rechnung Juli 2026");
    expect(body).toBe(
      "Hallo Birgit,\n\nanbei findest du die Rechnung für Juli 2026.\n\nLiebe Grüße und einen sonnigen Tag,\nHannes",
    );
  });

  it("still exposes the date-range period placeholder", () => {
    const vars = invoiceEmailPlaceholderVars({
      greetingName: "Birgit",
      invoiceNumber: "BAN2026006",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      operatorName: "Hannes",
      locale: "de",
    });

    expect(vars.period).toBe("01.07.2026 – 31.07.2026");
    expect(
      fillInvoiceEmailTemplate("Zeitraum {{period}}", vars),
    ).toBe("Zeitraum 01.07.2026 – 31.07.2026");
  });
});
