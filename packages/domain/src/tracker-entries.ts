import type { SupportedLocale } from "./locale.js";
import { formatDurationHMM, toLocalDateKey } from "./clockify-csv.js";

export type TrackerEntryInput = {
  id: string;
  startedAt: string;
  durationMinutes: number;
};

export type TrackerDayGroup<T extends TrackerEntryInput> = {
  date: string;
  dayLabel: string;
  totalDurationMinutes: number;
  entries: T[];
};

export type TrackerMonthGroup<T extends TrackerEntryInput> = {
  monthLabel: string;
  monthKey: string;
  totalDurationMinutes: number;
  days: TrackerDayGroup<T>[];
};

const WEEKDAY_FORMATTERS: Record<SupportedLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-US", { weekday: "short" }),
  de: new Intl.DateTimeFormat("de-DE", { weekday: "short" }),
};

const MONTH_DAY_FORMATTERS: Record<SupportedLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
  de: new Intl.DateTimeFormat("de-DE", { month: "short", day: "numeric" }),
};

const THIS_MONTH_LABEL: Record<SupportedLocale, string> = {
  en: "This month",
  de: "Dieser Monat",
};

const LAST_MONTH_LABEL: Record<SupportedLocale, string> = {
  en: "Last month",
  de: "Letzter Monat",
};

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatDayLabel(dateKey: string, locale: SupportedLocale): string {
  const date = parseDateKey(dateKey);
  const weekday = WEEKDAY_FORMATTERS[locale].format(date);
  const monthDay = MONTH_DAY_FORMATTERS[locale].format(date);
  return `${weekday}, ${monthDay}`;
}

function monthLabelForKey(
  monthKey: string,
  todayKey: string,
  locale: SupportedLocale,
): string {
  const thisMonthKey = monthKeyFromDateKey(todayKey);
  const lastMonthKey = previousMonthKey(thisMonthKey);

  if (monthKey === thisMonthKey) {
    return THIS_MONTH_LABEL[locale];
  }
  if (monthKey === lastMonthKey) {
    return LAST_MONTH_LABEL[locale];
  }

  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, 1));
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function groupTrackerEntriesByMonth<T extends TrackerEntryInput>(
  entries: T[],
  options: { timeZone: string; today?: string; locale?: SupportedLocale },
): TrackerMonthGroup<T>[] {
  const locale = options.locale ?? "en";
  const todayKey = options.today ?? toLocalDateKey(new Date(), options.timeZone);
  const byMonth = new Map<string, Map<string, T[]>>();

  for (const entry of entries) {
    const dateKey = toLocalDateKey(new Date(entry.startedAt), options.timeZone);
    const monthKey = monthKeyFromDateKey(dateKey);
    const monthDays = byMonth.get(monthKey) ?? new Map<string, T[]>();
    const dayEntries = monthDays.get(dateKey) ?? [];
    dayEntries.push(entry);
    monthDays.set(dateKey, dayEntries);
    byMonth.set(monthKey, monthDays);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, daysMap]) => {
      const days = [...daysMap.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEntries]) => ({
          date,
          dayLabel: formatDayLabel(date, locale),
          totalDurationMinutes: dayEntries.reduce(
            (sum, entry) => sum + entry.durationMinutes,
            0,
          ),
          entries: dayEntries.sort(
            (a, b) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          ),
        }));

      const totalDurationMinutes = days.reduce(
        (sum, day) => sum + day.totalDurationMinutes,
        0,
      );

      return {
        monthLabel: monthLabelForKey(monthKey, todayKey, locale),
        monthKey,
        totalDurationMinutes,
        days,
      };
    });
}

export function formatTrackerTotal(minutes: number): string {
  return formatDurationHMM(minutes);
}
