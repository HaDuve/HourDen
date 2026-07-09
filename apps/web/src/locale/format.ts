import type { SupportedLocale } from "@hourden/domain";

const CURRENCY = "EUR";

function intlLocale(locale: SupportedLocale): string {
  return locale === "de" ? "de-DE" : "en-US";
}

export function formatCurrency(amount: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatIsoDate(isoDate: string, locale: SupportedLocale): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return formatDate(new Date(Date.UTC(year!, month! - 1, day!)), locale);
}

export function formatHourlyRate(amount: number, locale: SupportedLocale): string {
  return `${formatCurrency(amount, locale)}/h`;
}

export function formatDurationMinutes(minutes: number, locale: SupportedLocale): string {
  if (minutes < 60) {
    return locale === "de" ? `${minutes} Min.` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (locale === "de") {
    return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
  }
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

export function formatAbbreviatedElapsed(totalSeconds: number, locale: SupportedLocale): string {
  if (totalSeconds < 60) {
    return locale === "de" ? `${totalSeconds} Sek.` : `${totalSeconds} sec`;
  }

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    return locale === "de" ? `${minutes} Min.` : `${minutes} min`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (locale === "de") {
    return minutes > 0 ? `${hours} Std. ${minutes} Min.` : `${hours} Std.`;
  }
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}
