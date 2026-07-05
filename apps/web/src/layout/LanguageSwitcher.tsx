import type { SupportedLocale } from "@hourden/domain";
import { useTranslation } from "react-i18next";
import { useLocale } from "../locale/LocaleContext.js";

const LOCALES: SupportedLocale[] = ["en", "de"];

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, changeLocale } = useLocale();

  return (
    <div
      role="radiogroup"
      aria-label={t("language.label")}
      className="flex flex-col gap-1 px-3 py-2"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {t("language.label")}
      </span>
      <div className="flex gap-1">
        {LOCALES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={locale === value}
            onClick={() => void changeLocale(value)}
            className={`rounded-md px-2 py-1 text-sm ${
              locale === value
                ? "bg-slate-900 font-medium text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {t(`language.${value}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
