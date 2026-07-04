import { isSupportedLocale, type SupportedLocale } from "@hourden/domain";

const STORAGE_KEY = "hourden.locale";

export function readStoredLocale(): SupportedLocale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore storage failures in private mode
  }
}

export function readAcceptLanguage(): string | null {
  return typeof navigator !== "undefined" ? navigator.language : null;
}
