import type { SupportedLocale } from "@hourden/domain";
import { formatBillingMonth, formatIsoDate } from "../locale/format.js";

export function fillInvoiceEmailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
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
