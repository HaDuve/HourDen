import type { SupportedLocale } from "@hourden/domain";
import { formatBillingMonth, formatIsoDate } from "../locale/format.js";

/** Pass-through so i18next leaves `{{token}}` literals in default template strings. */
export const invoiceEmailPlaceholderLiterals = {
  greetingName: "{{greetingName}}",
  invoiceNumber: "{{invoiceNumber}}",
  period: "{{period}}",
  billingMonth: "{{billingMonth}}",
  operatorName: "{{operatorName}}",
} as const;

export function fillInvoiceEmailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}

export function resolveInvoiceEmailTemplates(input: {
  clientSubject: string | null | undefined;
  clientBody: string | null | undefined;
  workspaceSubject: string | null | undefined;
  workspaceBody: string | null | undefined;
  defaultSubject: string;
  defaultBody: string;
}): { subjectTemplate: string; bodyTemplate: string } {
  return {
    subjectTemplate:
      input.clientSubject ||
      input.workspaceSubject ||
      input.defaultSubject,
    bodyTemplate:
      input.clientBody || input.workspaceBody || input.defaultBody,
  };
}

export function invoiceEmailPlaceholderVars(input: {
  greetingName: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  operatorName: string;
  locale: SupportedLocale;
}): Record<string, string> {
  return {
    greetingName: input.greetingName,
    invoiceNumber: input.invoiceNumber,
    period: `${formatIsoDate(input.periodStart, input.locale)} – ${formatIsoDate(input.periodEnd, input.locale)}`,
    billingMonth: formatBillingMonth(input.periodEnd, input.locale),
    operatorName: input.operatorName,
  };
}
