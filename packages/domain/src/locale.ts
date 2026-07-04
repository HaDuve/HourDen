export const SUPPORTED_LOCALES = ["en", "de"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

const LOCALE_PATTERN = /(?:^|,)\s*(de|en)(?:-|;|,|$)/i;

export function parseAcceptLanguage(header: string | null | undefined): SupportedLocale {
  if (!header) {
    return "en";
  }

  const match = header.match(LOCALE_PATTERN);
  if (!match) {
    return "en";
  }

  const candidate = match[1]!.toLowerCase();
  return isSupportedLocale(candidate) ? candidate : "en";
}
