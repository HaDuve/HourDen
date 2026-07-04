import { isSupportedLocale, parseAcceptLanguage, type SupportedLocale } from "@hourden/domain";

export type ResolveLocaleInput = {
  userLocale: SupportedLocale | null | undefined;
  storedLocale: SupportedLocale | null;
  acceptLanguage: string | null;
};

export function resolveLocale(input: ResolveLocaleInput): SupportedLocale {
  if (isSupportedLocale(input.userLocale)) {
    return input.userLocale;
  }

  if (isSupportedLocale(input.storedLocale)) {
    return input.storedLocale;
  }

  return parseAcceptLanguage(input.acceptLanguage);
}
