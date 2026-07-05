import type { SupportedLocale } from "@hourden/domain";

export function formatEntryDateTime(iso: string, locale: SupportedLocale): string {
  const intlLocale = locale === "de" ? "de-DE" : "en-US";
  return new Intl.DateTimeFormat(intlLocale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
