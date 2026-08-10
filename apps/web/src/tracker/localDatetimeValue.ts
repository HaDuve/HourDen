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
