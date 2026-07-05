import { isSupportedLocale, type SupportedLocale } from "@hourden/domain";
import { useTranslation } from "react-i18next";
import {
  formatCurrency,
  formatDate,
  formatDurationMinutes,
  formatHourlyRate,
  formatIsoDate,
} from "./format.js";

export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const locale: SupportedLocale = isSupportedLocale(i18n.language) ? i18n.language : "en";

  return {
    locale,
    formatCurrency: (amount: number) => formatCurrency(amount, locale),
    formatDate: (date: Date) => formatDate(date, locale),
    formatIsoDate: (isoDate: string) => formatIsoDate(isoDate, locale),
    formatHourlyRate: (amount: number) => formatHourlyRate(amount, locale),
    formatDurationMinutes: (minutes: number) => formatDurationMinutes(minutes, locale),
  };
}
