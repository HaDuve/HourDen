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
  const header = CLOCKIFY_HEADERS.map(csvField).join(",");
  const rows = entries.map((entry) => serializeRow(entry, options));
  return [header, ...rows].join("\n");
}

function serializeRow(
  entry: ClockifyExportEntry,
  options: ClockifyExportOptions,
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
    formatClockifyDate(entry.startedAt),
    formatClockifyTime(entry.startedAt),
    formatClockifyDate(entry.endedAt),
    formatClockifyTime(entry.endedAt),
    formatDurationHMM(entry.durationMinutes),
    formatDurationDecimal(entry.durationMinutes),
    formatMoney(entry.billableRate),
    formatMoney(entry.billableAmount),
    formatClockifyDate(entry.startedAt),
  ];

  return fields.map(csvField).join(",");
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatClockifyDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatClockifyTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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
