import { toLocalDateKey } from "./clockify-csv.js";

export type DayRibbonEntryInput = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

export type DayRibbonBlock = {
  id: string;
  /** 0–100: left edge within the ribbon window */
  leftPct: number;
  /** 0–100: width within the ribbon window */
  widthPct: number;
  clippedStartMs: number;
  clippedEndMs: number;
  isRunning: boolean;
};

export type DayRibbonLayout = {
  windowStartMs: number;
  windowEndMs: number;
  blocks: DayRibbonBlock[];
};

/** Sensible default working-hours window (local clock). */
export const DAY_RIBBON_DEFAULT_WINDOW = {
  startHour: 8,
  endHour: 18,
} as const;

export type DayRibbonDefaultWindow = {
  startHour: number;
  /** Exclusive local hour; 24 = next local midnight */
  endHour: number;
};

export function layoutDayRibbon(
  dateKey: string,
  entries: DayRibbonEntryInput[],
  options: {
    timeZone: string;
    now?: Date;
    defaultWindow?: DayRibbonDefaultWindow;
  },
): DayRibbonLayout {
  const timeZone = options.timeZone;
  const nowMs = (options.now ?? new Date()).getTime();
  const windowHours = options.defaultWindow ?? DAY_RIBBON_DEFAULT_WINDOW;

  const dayStartMs = instantAtLocal(dateKey, 0, 0, 0, timeZone);
  const dayEndMs = instantAtLocal(addCalendarDays(dateKey, 1), 0, 0, 0, timeZone);

  const defaultStartMs = instantAtLocal(
    dateKey,
    windowHours.startHour,
    0,
    0,
    timeZone,
  );
  const defaultEndMs =
    windowHours.endHour >= 24
      ? dayEndMs
      : instantAtLocal(dateKey, windowHours.endHour, 0, 0, timeZone);

  const clipped: Array<{
    id: string;
    startMs: number;
    endMs: number;
    isRunning: boolean;
  }> = [];

  for (const entry of entries) {
    const isRunning = entry.endedAt === null;
    const rawStart = Date.parse(entry.startedAt);
    const rawEnd = isRunning ? nowMs : Date.parse(entry.endedAt!);
    const startMs = Math.max(rawStart, dayStartMs);
    const endMs = Math.min(rawEnd, dayEndMs);
    if (!(endMs > startMs)) continue;
    // Only include if the entry belongs to this calendar day via overlap —
    // also drop entries whose start falls on another day and never overlap
    // (already handled by endMs > startMs against day bounds).
    clipped.push({ id: entry.id, startMs, endMs, isRunning });
  }

  let windowStartMs = defaultStartMs;
  let windowEndMs = defaultEndMs;
  for (const block of clipped) {
    windowStartMs = Math.min(windowStartMs, block.startMs);
    windowEndMs = Math.max(windowEndMs, block.endMs);
  }

  const span = windowEndMs - windowStartMs;
  const blocks: DayRibbonBlock[] = clipped.map((block) => ({
    id: block.id,
    leftPct: span === 0 ? 0 : ((block.startMs - windowStartMs) / span) * 100,
    widthPct: span === 0 ? 0 : ((block.endMs - block.startMs) / span) * 100,
    clippedStartMs: block.startMs,
    clippedEndMs: block.endMs,
    isRunning: block.isRunning,
  }));

  return { windowStartMs, windowEndMs, blocks };
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  utc.setUTCDate(utc.getUTCDate() + days);
  return toLocalDateKey(utc, "UTC");
}

/**
 * UTC epoch ms for a wall-clock time in `timeZone` on `dateKey` (YYYY-MM-DD).
 */
export function instantAtLocal(
  dateKey: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = {
    year: year!,
    month: month!,
    day: day!,
    hour,
    minute,
    second,
  };

  let low = Date.UTC(year!, month! - 1, day! - 1, 0, 0, 0, 0);
  let high = Date.UTC(year!, month! - 1, day! + 1, 23, 59, 59, 999);
  const secondMs = 1000;

  while (low <= high) {
    const mid = Math.floor((low + high) / (2 * secondMs)) * secondMs;
    const cmp = compareZonedParts(getZonedParts(new Date(mid), timeZone), target);
    if (cmp === 0) return mid;
    if (cmp < 0) low = mid + secondMs;
    else high = mid - secondMs;
  }

  return low;
}

function compareZonedParts(
  actual: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  target: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
): number {
  if (actual.year !== target.year) return actual.year - target.year;
  if (actual.month !== target.month) return actual.month - target.month;
  if (actual.day !== target.day) return actual.day - target.day;
  if (actual.hour !== target.hour) return actual.hour - target.hour;
  if (actual.minute !== target.minute) return actual.minute - target.minute;
  return actual.second - target.second;
}

function getZonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}
