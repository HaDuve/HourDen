export const DEFAULT_REPORT_TIMEZONE = "Europe/Berlin";

export type ClockifyExportEntry = {
  projectName: string;
  clientName: string;
  description: string;
  tags: string[];
  billable: boolean;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  billableRate: number;
  billableAmount: number;
};

export type ClockifyExportOptions = {
  operatorName: string;
  operatorEmail: string;
  timeZone?: string;
};

const CLOCKIFY_HEADERS = [
  "Project",
  "Client",
  "Description",
  "Task",
  "User",
  "Group",
  "Email",
  "Tags",
  "Billable",
  "Start Date",
  "Start Time",
  "End Date",
  "End Time",
  "Duration (h)",
  "Duration (decimal)",
  "Billable Rate (EUR)",
  "Billable Amount (EUR)",
  "Date of creation",
] as const;

export function serializeClockifyCsv(
  entries: ClockifyExportEntry[],
  options: ClockifyExportOptions,
): string {
  const timeZone = options.timeZone ?? DEFAULT_REPORT_TIMEZONE;
  const header = CLOCKIFY_HEADERS.map(csvField).join(",");
  const rows = entries.map((entry) => serializeRow(entry, options, timeZone));
  return [header, ...rows].join("\n");
}

function serializeRow(
  entry: ClockifyExportEntry,
  options: ClockifyExportOptions,
  timeZone: string,
): string {
  const fields = [
    entry.projectName,
    entry.clientName,
    entry.description,
    "",
    options.operatorName,
    "",
    options.operatorEmail,
    entry.tags.join(", "),
    entry.billable ? "Yes" : "No",
    formatClockifyDate(entry.startedAt, timeZone),
    formatClockifyTime(entry.startedAt, timeZone),
    formatClockifyDate(entry.endedAt, timeZone),
    formatClockifyTime(entry.endedAt, timeZone),
    formatDurationHMM(entry.durationMinutes),
    formatDurationDecimal(entry.durationMinutes),
    formatMoney(entry.billableRate),
    formatMoney(entry.billableAmount),
    formatClockifyDate(entry.startedAt, timeZone),
  ];

  return fields.map(csvField).join(",");
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function toLocalDateKey(
  date: Date,
  timeZone = DEFAULT_REPORT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatClockifyDate(
  date: Date,
  timeZone = DEFAULT_REPORT_TIMEZONE,
): string {
  const [year, month, day] = toLocalDateKey(date, timeZone).split("-");
  return `${day}/${month}/${year}`;
}

export function formatClockifyTime(
  date: Date,
  timeZone = DEFAULT_REPORT_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "0";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${Number(hour)}:${minute}`;
}

export function formatDurationHMM(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatDurationDecimal(durationMinutes: number): string {
  const hours = durationMinutes / 60;
  return hours.toFixed(2);
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}
