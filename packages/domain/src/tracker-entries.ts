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

export type TrackerWeekGroup<T extends TrackerEntryInput> = {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
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

const THIS_WEEK_LABEL: Record<SupportedLocale, string> = {
  en: "This week",
  de: "Diese Woche",
};

const LAST_WEEK_LABEL: Record<SupportedLocale, string> = {
  en: "Last week",
  de: "Letzte Woche",
};

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

function mondayOfWeek(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const weekday = date.getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return formatDateKey(date);
}

function formatDayLabel(dateKey: string, locale: SupportedLocale): string {
  const date = parseDateKey(dateKey);
  const weekday = WEEKDAY_FORMATTERS[locale].format(date);
  const monthDay = MONTH_DAY_FORMATTERS[locale].format(date);
  return `${weekday}, ${monthDay}`;
}

function formatWeekRangeLabel(
  weekStart: string,
  weekEnd: string,
  locale: SupportedLocale,
): string {
  const start = parseDateKey(weekStart);
  const end = parseDateKey(weekEnd);
  const startLabel = MONTH_DAY_FORMATTERS[locale].format(start);
  const endLabel = MONTH_DAY_FORMATTERS[locale].format(end);
  return `${startLabel} - ${endLabel}`;
}

function weekLabelForRange(
  weekStart: string,
  weekEnd: string,
  todayKey: string,
  locale: SupportedLocale,
): string {
  const thisWeekStart = mondayOfWeek(todayKey);
  const lastWeekStart = addDays(thisWeekStart, -7);

  if (weekStart === thisWeekStart) {
    return THIS_WEEK_LABEL[locale];
  }
  if (weekStart === lastWeekStart) {
    return LAST_WEEK_LABEL[locale];
  }
  return formatWeekRangeLabel(weekStart, weekEnd, locale);
}

export function groupTrackerEntriesByWeek<T extends TrackerEntryInput>(
  entries: T[],
  options: { timeZone: string; today?: string; locale?: SupportedLocale },
): TrackerWeekGroup<T>[] {
  const locale = options.locale ?? "en";
  const todayKey = options.today ?? toLocalDateKey(new Date(), options.timeZone);
  const byWeek = new Map<string, Map<string, T[]>>();

  for (const entry of entries) {
    const dateKey = toLocalDateKey(new Date(entry.startedAt), options.timeZone);
    const weekStart = mondayOfWeek(dateKey);
    const weekDays = byWeek.get(weekStart) ?? new Map<string, T[]>();
    const dayEntries = weekDays.get(dateKey) ?? [];
    dayEntries.push(entry);
    weekDays.set(dateKey, dayEntries);
    byWeek.set(weekStart, weekDays);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, daysMap]) => {
      const weekEnd = addDays(weekStart, 6);
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
        weekLabel: weekLabelForRange(weekStart, weekEnd, todayKey, locale),
        weekStart,
        weekEnd,
        totalDurationMinutes,
        days,
      };
    });
}

export function formatTrackerTotal(minutes: number): string {
  return formatDurationHMM(minutes);
}
