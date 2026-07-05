import { isSupportedLocale, type SupportedLocale } from "@hourden/domain";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { applyLocale } from "./i18n/i18n.js";
import { LocaleContext } from "./locale/LocaleContext.js";
import { resolveLocale } from "./locale/resolve-locale.js";
import {
  readAcceptLanguage,
  readStoredLocale,
  writeStoredLocale,
} from "./locale/storage.js";
import { updateUserLocale } from "./locale/update-user-locale.js";
import { metaTextClass } from "./layout/ui-classes.js";

type LocaleProviderProps = {
  children: ReactNode;
  userLocale: SupportedLocale | null;
};

export function LocaleProvider({ children, userLocale }: LocaleProviderProps) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [activeLocale, setActiveLocale] = useState<SupportedLocale>("en");

  useEffect(() => {
    let cancelled = false;

    async function bootstrapLocale() {
      const storedLocale = readStoredLocale();
      if (storedLocale) {
        await applyLocale(storedLocale);
      }

      const locale = resolveLocale({
        userLocale,
        storedLocale,
        acceptLanguage: readAcceptLanguage(),
      });

      writeStoredLocale(locale);
      await applyLocale(locale);

      if (!cancelled) {
        setActiveLocale(locale);
        setReady(true);
      }
    }

    void bootstrapLocale();

    return () => {
      cancelled = true;
    };
  }, [userLocale]);

  const changeLocale = useCallback(async (locale: SupportedLocale) => {
    if (!isSupportedLocale(locale)) {
      return;
    }
    await updateUserLocale(locale);
    setActiveLocale(locale);
  }, []);

  if (!ready) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${metaTextClass}`}>
        {t("common.loading")}
      </div>
    );
  }

  return (
    <LocaleContext.Provider value={{ locale: activeLocale, changeLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
