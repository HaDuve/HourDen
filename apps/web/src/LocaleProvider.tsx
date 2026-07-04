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
};

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapLocale() {
      const storedLocale = readStoredLocale();
      if (storedLocale) {
        await applyLocale(storedLocale);
      }

      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (cancelled) {
        return;
      }

      let userLocale: SupportedLocale | null = null;
      if (res.ok) {
        const data = (await res.json()) as {
          user?: { locale?: SupportedLocale | null };
        };
        const value = data.user?.locale;
        userLocale = isSupportedLocale(value) ? value : null;
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
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  return children;
}
