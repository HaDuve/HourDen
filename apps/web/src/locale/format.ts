import type { SupportedLocale } from "@hourden/domain";

const CURRENCY = "EUR";

export function formatCurrency(amount: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
