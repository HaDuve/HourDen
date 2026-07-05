import {
  currentMonthRange,
  lastMonthRange,
  shiftMonthRange,
  type DateRange,
} from "./date-range.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useTranslation } from "react-i18next";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  periodLabel?: string;
};

export function DateRangeFilter({
  from,
  to,
  onChange,
  periodLabel,
}: DateRangeFilterProps) {
  const { t } = useTranslation();
  const range = { from, to };
  const isMobile = useIsMobile();
  const quickButtonClass = isMobile
    ? "min-h-11 rounded-md border border-neutral-300 px-3 text-sm text-neutral-700 hover:bg-neutral-50"
    : "rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-50";
  const navButtonClass = isMobile
    ? "min-h-11 min-w-11 rounded-md border border-neutral-300 px-3 text-sm text-neutral-700 hover:bg-neutral-50"
    : "rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-50";
  const dateInputClass = isMobile
    ? "min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2"
    : "rounded-md border border-neutral-300 px-3 py-2";

  return (
    <div className="flex flex-col gap-2">
      {periodLabel ? (
        <span className="text-sm font-medium text-neutral-900">{periodLabel}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
        <button
          type="button"
          aria-label={t("dateRange.previousMonth")}
          className={navButtonClass}
          onClick={() => onChange(shiftMonthRange(range, -1))}
        >
          ‹
        </button>
        <button
          type="button"
          className={quickButtonClass}
          onClick={() => onChange(lastMonthRange())}
        >
          {t("dateRange.lastMonth")}
        </button>
        <button
          type="button"
          className={quickButtonClass}
          onClick={() => onChange(currentMonthRange())}
        >
          {t("dateRange.thisMonth")}
        </button>
        <button
          type="button"
          aria-label={t("dateRange.nextMonth")}
          className={navButtonClass}
          onClick={() => onChange(shiftMonthRange(range, 1))}
        >
          ›
        </button>
      </div>
      <div className={`flex gap-4 ${isMobile ? "flex-col" : "flex-wrap"}`}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-neutral-700">
          {t("dateRange.from")}
          <input
            type="date"
            value={from}
            onChange={(e) => onChange({ from: e.target.value, to })}
            className={dateInputClass}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-neutral-700">
          {t("dateRange.to")}
          <input
            type="date"
            value={to}
            onChange={(e) => onChange({ from, to: e.target.value })}
            className={dateInputClass}
          />
        </label>
      </div>
    </div>
  );
}
