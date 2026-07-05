import {
  currentMonthRange,
  lastMonthRange,
  shiftMonthRange,
  type DateRange,
} from "./date-range.js";
import {
  fieldLabelClass,
  inputClass,
  inputClassMobile,
} from "./layout/ui-classes.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useTranslation } from "react-i18next";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  periodLabel?: string;
};

const quickButtonBase =
  "rounded-md border border-secondary-border bg-secondary text-secondary-content hover:bg-secondary-hover";
const navButtonBase = quickButtonBase;

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
    ? `min-h-11 ${quickButtonBase} px-3 text-sm`
    : `${quickButtonBase} px-2 py-1 text-sm`;
  const navButtonClass = isMobile
    ? `min-h-11 min-w-11 ${navButtonBase} px-3 text-sm`
    : `${navButtonBase} px-2 py-1 text-sm`;
  const dateInputClass = isMobile ? inputClassMobile : inputClass;

  return (
    <div className="flex flex-col gap-2">
      {periodLabel ? (
        <span className={fieldLabelClass}>{periodLabel}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
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
        <label className={`flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted`}>
          {t("dateRange.from")}
          <input
            type="date"
            value={from}
            onChange={(e) => onChange({ from: e.target.value, to })}
            className={dateInputClass}
          />
        </label>
        <label className={`flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted`}>
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
