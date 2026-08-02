import { describe, expect, it } from "vitest";
import {
  fillInvoiceEmailTemplate,
  invoiceEmailPlaceholderVars,
  resolveInvoiceEmailTemplates,
} from "./invoice-email-template.js";

const deDefaults = {
  defaultSubject: "Rechnung {{billingMonth}}",
  defaultBody:
    "Hallo {{greetingName}},\n\nanbei findest du die Rechnung für {{billingMonth}}.\n\nLiebe Grüße und einen sonnigen Tag,\n{{operatorName}}",
};

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

  it("empty Client and Workspace templates fall back to locale defaults then fill", () => {
    const { subjectTemplate, bodyTemplate } = resolveInvoiceEmailTemplates({
      clientSubject: null,
      clientBody: null,
      workspaceSubject: null,
      workspaceBody: null,
      ...deDefaults,
    });
    const vars = invoiceEmailPlaceholderVars({
      greetingName: "Birgit",
      invoiceNumber: "BAN2026006",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      operatorName: "Hannes",
      locale: "de",
    });

    expect(fillInvoiceEmailTemplate(subjectTemplate, vars)).toBe(
      "Rechnung Juli 2026",
    );
    expect(fillInvoiceEmailTemplate(bodyTemplate, vars)).toBe(
      "Hallo Birgit,\n\nanbei findest du die Rechnung für Juli 2026.\n\nLiebe Grüße und einen sonnigen Tag,\nHannes",
    );
  });

  it("Client template wins over Workspace and locale defaults", () => {
    const { subjectTemplate, bodyTemplate } = resolveInvoiceEmailTemplates({
      clientSubject: "Custom {{invoiceNumber}}",
      clientBody: "Hi {{greetingName}}",
      workspaceSubject: "Workspace {{billingMonth}}",
      workspaceBody: "Workspace body",
      ...deDefaults,
    });

    expect(subjectTemplate).toBe("Custom {{invoiceNumber}}");
    expect(bodyTemplate).toBe("Hi {{greetingName}}");
  });
});
