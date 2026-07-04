import i18n from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";
import type { SupportedLocale } from "@hourden/domain";
import { readStoredLocale } from "../locale/storage.js";

const initialLocale = readStoredLocale() ?? "en";

void i18n
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`../locales/${language}/${namespace}.json`),
    ),
  )
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: "en",
    supportedLngs: ["en", "de"],
    ns: ["common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export async function applyLocale(locale: SupportedLocale): Promise<void> {
  if (i18n.language === locale) {
    return;
  }
  await i18n.changeLanguage(locale);
}

export default i18n;
