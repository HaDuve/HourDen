import {
  currentMonthRange,
  lastMonthRange,
  shiftMonthRange,
  type DateRange,
} from "./date-range.js";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
};

const quickButtonClass =
  "rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-50";

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const range = { from, to };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-neutral-700">
        <button
          type="button"
          aria-label="Previous month"
          className={quickButtonClass}
          onClick={() => onChange(shiftMonthRange(range, -1))}
        >
          &lt;
        </button>
        <button
          type="button"
          aria-label="Last month"
          className={quickButtonClass}
          onClick={() => onChange(lastMonthRange())}
        >
          last
        </button>
        <button
          type="button"
          aria-label="This month"
          className={quickButtonClass}
          onClick={() => onChange(currentMonthRange())}
        >
          this
        </button>
        <button
          type="button"
          aria-label="Next month"
          className={quickButtonClass}
          onClick={() => onChange(shiftMonthRange(range, 1))}
        >
          &gt;
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => onChange({ from: e.target.value, to })}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => onChange({ from, to: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>
    </div>
  );
}
