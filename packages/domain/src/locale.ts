export const SUPPORTED_LOCALES = ["en", "de"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

function primaryLanguageTag(tag: string): SupportedLocale | null {
  const primary = tag.trim().toLowerCase().split("-")[0];
  return isSupportedLocale(primary) ? primary : null;
}

function parseQValue(params: string[]): number {
  for (const param of params) {
    const [key, rawValue] = param.trim().split("=");
    if (key === "q" && rawValue) {
      const q = Number.parseFloat(rawValue);
      if (!Number.isNaN(q)) {
        return q;
      }
    }
  }
  return 1;
}

export function parseAcceptLanguage(header: string | null | undefined): SupportedLocale {
  if (!header) {
    return "en";
  }

  let best: { locale: SupportedLocale; q: number } | null = null;

  for (const part of header.split(",")) {
    const segments = part.trim().split(";");
    const locale = primaryLanguageTag(segments[0] ?? "");
    if (!locale) {
      continue;
    }

    const q = parseQValue(segments.slice(1));
    if (q === 0) {
      continue;
    }

    if (!best || q > best.q) {
      best = { locale, q };
    }
  }

  return best?.locale ?? "en";
}
