import { isSupportedLocale, type SupportedLocale } from "@hourden/domain";
import { useEffect, useState, type ReactNode } from "react";
import { applyLocale } from "./i18n/i18n.js";
import { resolveLocale } from "./locale/resolve-locale.js";
import {
  readAcceptLanguage,
  readStoredLocale,
  writeStoredLocale,
} from "./locale/storage.js";

type LocaleProviderProps = {
  children: ReactNode;
  userLocale: SupportedLocale | null;
};

export function LocaleProvider({ children, userLocale }: LocaleProviderProps) {
  const [ready, setReady] = useState(false);

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
        setReady(true);
      }
    }

    void bootstrapLocale();

    return () => {
      cancelled = true;
    };
  }, [userLocale]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  return children;
}
