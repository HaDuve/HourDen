export type DateRange = {
  from: string;
  to: string;
};

function formatDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function calendarMonthRange(year: number, month: number): DateRange {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

export function currentMonthRange(reference = new Date()): DateRange {
  return calendarMonthRange(reference.getFullYear(), reference.getMonth() + 1);
}

export function lastMonthRange(reference = new Date()): DateRange {
  const date = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return calendarMonthRange(date.getFullYear(), date.getMonth() + 1);
}

export function shiftMonthRange(range: DateRange, deltaMonths: number): DateRange {
  const [year, month] = range.from.split("-").map(Number);
  const shifted = new Date(year, month - 1 + deltaMonths, 1);
  return calendarMonthRange(shifted.getFullYear(), shifted.getMonth() + 1);
}

export function isFullCalendarMonth(range: DateRange): boolean {
  const [year, month, fromDay] = range.from.split("-").map(Number);
  if (fromDay !== 1) {
    return false;
  }
  return range.to === calendarMonthRange(year, month).to;
}

export function isThisMonthRange(
  range: DateRange,
  reference = new Date(),
): boolean {
  if (!isFullCalendarMonth(range)) {
    return false;
  }
  const thisMonth = currentMonthRange(reference);
  return range.from === thisMonth.from && range.to === thisMonth.to;
}

export function isLastMonthRange(
  range: DateRange,
  reference = new Date(),
): boolean {
  if (!isFullCalendarMonth(range)) {
    return false;
  }
  const lastMonth = lastMonthRange(reference);
  return range.from === lastMonth.from && range.to === lastMonth.to;
}
