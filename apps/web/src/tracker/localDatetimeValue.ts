export function localDatetimeValue(date: Date): string {
  return `${localDateValue(date)}T${localTimeValue(date)}`;
}

export function localDateValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combine local YYYY-MM-DD + HH:mm into an ISO instant. */
export function localDateAndTimeToIso(dateYmd: string, timeHm: string): string {
  return new Date(`${dateYmd}T${timeHm}`).toISOString();
}

/** Move an instant onto a new local calendar day, keeping local clock time. */
export function applyLocalDate(iso: string, dateYmd: string): string {
  return localDateAndTimeToIso(dateYmd, localTimeValue(new Date(iso)));
}

function parseLocalDateYmd(dateYmd: string): { year: number; monthIndex: number; day: number } {
  const [year, month, day] = dateYmd.split("-").map(Number);
  return { year: year!, monthIndex: month! - 1, day: day! };
}

export function daysBetweenLocalDates(fromYmd: string, toYmd: string): number {
  const from = parseLocalDateYmd(fromYmd);
  const to = parseLocalDateYmd(toYmd);
  const fromUtc = Date.UTC(from.year, from.monthIndex, from.day);
  const toUtc = Date.UTC(to.year, to.monthIndex, to.day);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function shiftLocalDateYmd(dateYmd: string, days: number): string {
  const { year, monthIndex, day } = parseLocalDateYmd(dateYmd);
  return localDateValue(new Date(year, monthIndex, day + days));
}

/** Shift an instant by the local-day delta between fromYmd and toYmd, keeping clock time. */
export function shiftInstantByLocalDateDelta(
  iso: string,
  fromYmd: string,
  toYmd: string,
): string {
  const days = daysBetweenLocalDates(fromYmd, toYmd);
  const current = new Date(iso);
  return new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate() + days,
    current.getHours(),
    current.getMinutes(),
    current.getSeconds(),
    current.getMilliseconds(),
  ).toISOString();
}

export type ScheduleFieldsValue = {
  date: string;
  startTime: string;
  endTime: string;
};

export type ScheduleDatetimeValues = {
  startedAt: string;
  endedAt: string;
};

/**
 * Apply schedule field edits to local datetime strings.
 * Time-only edits keep each side's local date; calendar day edits shift both by the same delta.
 */
export function applyScheduleFieldsChange(
  previous: ScheduleDatetimeValues,
  next: ScheduleFieldsValue,
): ScheduleDatetimeValues {
  const prevStartDate = previous.startedAt.slice(0, 10);
  const prevEndDate = previous.endedAt.slice(0, 10);

  if (next.date === prevStartDate) {
    return {
      startedAt: `${prevStartDate}T${next.startTime}`,
      endedAt: `${prevEndDate}T${next.endTime}`,
    };
  }

  const days = daysBetweenLocalDates(prevStartDate, next.date);
  return {
    startedAt: `${next.date}T${next.startTime}`,
    endedAt: `${shiftLocalDateYmd(prevEndDate, days)}T${next.endTime}`,
  };
}
