import { isSupportedLocale, type SupportedLocale } from "@hourden/domain";
import { useTranslation } from "react-i18next";
import { applyLocale } from "../i18n/i18n.js";
import { writeStoredLocale } from "../locale/storage.js";

const LOCALES: SupportedLocale[] = ["en", "de"];

export function PublicLanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const activeLocale = isSupportedLocale(i18n.language) ? i18n.language : "en";

  async function handleSelect(nextLocale: SupportedLocale) {
    if (nextLocale === activeLocale) {
      return;
    }
    writeStoredLocale(nextLocale);
    await applyLocale(nextLocale);
  }

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="absolute right-4 top-4 flex gap-1"
    >
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={activeLocale === value}
          onClick={() => void handleSelect(value)}
          className={`rounded-md px-2 py-1 text-xs uppercase tracking-wide ${
            activeLocale === value
              ? "bg-surface-active font-medium text-content"
              : "text-muted hover:bg-surface-hover hover:text-content"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
