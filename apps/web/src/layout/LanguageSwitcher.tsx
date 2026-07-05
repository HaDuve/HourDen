import type { SupportedLocale } from "@hourden/domain";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "../locale/LocaleContext.js";

const LOCALES: SupportedLocale[] = ["en", "de"];

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, changeLocale } = useLocale();
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(nextLocale: SupportedLocale) {
    if (changing || nextLocale === locale) {
      return;
    }
    setError(null);
    setChanging(true);
    try {
      await changeLocale(nextLocale);
    } catch {
      setError(t("language.updateFailed"));
    } finally {
      setChanging(false);
    }
  }

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="flex flex-col gap-1 border-t border-divider px-3 py-2"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {t("language.label")}
      </span>
      <div className="flex gap-1">
        {LOCALES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={locale === value}
            disabled={changing}
            onClick={() => void handleSelect(value)}
            className={`rounded-md px-2 py-1 text-sm disabled:opacity-50 ${
              locale === value
                ? "bg-surface-active font-medium text-content"
                : "text-muted hover:bg-surface-hover hover:text-content"
            }`}
          >
            {t(`language.${value}`)}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
