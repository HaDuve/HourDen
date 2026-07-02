import {
  DEFAULT_REPORT_TIMEZONE,
  formatDurationHMM,
} from "./clockify-csv.js";

export type ClockifyParsedRow = {
  projectName: string;
  clientName: string;
  description: string;
  tags: string[];
  billable: boolean;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  billableRate: number | null;
  billableAmount: number | null;
  skipped: boolean;
  skipReason?: "empty_client";
};

export type ParseClockifyCsvOptions = {
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

export function parseClockifyCsv(
  csv: string,
  options: ParseClockifyCsvOptions = {},
): ClockifyParsedRow[] {
  const timeZone = options.timeZone ?? DEFAULT_REPORT_TIMEZONE;
  const lines = csv.replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]!);
  const columnIndex = Object.fromEntries(
    CLOCKIFY_HEADERS.map((name) => [name, header.indexOf(name)]),
  ) as Record<(typeof CLOCKIFY_HEADERS)[number], number>;

  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    const get = (name: (typeof CLOCKIFY_HEADERS)[number]) =>
      fields[columnIndex[name]] ?? "";

    const clientName = get("Client").trim();
    if (!clientName) {
      return emptySkippedRow();
    }

    const tagsRaw = get("Tags").trim();
    const tags = tagsRaw
      ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

    const startedAt = parseClockifyDateTime(
      get("Start Date"),
      get("Start Time"),
      timeZone,
    );
    const endedAt = parseClockifyDateTime(
      get("End Date"),
      get("End Time"),
      timeZone,
    );

    return {
      projectName: get("Project").trim(),
      clientName,
      description: get("Description").trim(),
      tags,
      billable: get("Billable").trim().toLowerCase() === "yes",
      startedAt,
      endedAt,
      durationMinutes: parseDurationHMM(get("Duration (h)")),
      billableRate: parseOptionalMoney(get("Billable Rate (EUR)")),
      billableAmount: parseOptionalMoney(get("Billable Amount (EUR)")),
      skipped: false,
    };
  });
}

function emptySkippedRow(): ClockifyParsedRow {
  return {
    projectName: "",
    clientName: "",
    description: "",
    tags: [],
    billable: false,
    startedAt: new Date(0),
    endedAt: new Date(0),
    durationMinutes: 0,
    billableRate: null,
    billableAmount: null,
    skipped: true,
    skipReason: "empty_client",
  };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

export function parseClockifyDateTime(
  dateStr: string,
  timeStr: string,
  timeZone = DEFAULT_REPORT_TIMEZONE,
): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const target = { year, month, day, hour, minute };

  let low = Date.UTC(year, month - 1, day - 1, 0, 0, 0, 0);
  let high = Date.UTC(year, month - 1, day + 1, 23, 59, 0, 0);
  const minuteMs = 60_000;

  while (low <= high) {
    const mid = Math.floor((low + high) / (2 * minuteMs)) * minuteMs;
    const cmp = compareZonedParts(getZonedParts(new Date(mid), timeZone), target);

    if (cmp === 0) {
      return new Date(mid);
    }

    if (cmp < 0) {
      low = mid + minuteMs;
    } else {
      high = mid - minuteMs;
    }
  }

  return new Date(low);
}

function compareZonedParts(
  actual: { year: number; month: number; day: number; hour: number; minute: number },
  target: { year: number; month: number; day: number; hour: number; minute: number },
): number {
  if (actual.year !== target.year) return actual.year - target.year;
  if (actual.month !== target.month) return actual.month - target.month;
  if (actual.day !== target.day) return actual.day - target.day;
  if (actual.hour !== target.hour) return actual.hour - target.hour;
  return actual.minute - target.minute;
}

function getZonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
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
  };
}

export function parseDurationHMM(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const [hoursPart, minutesPart = "0"] = trimmed.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function parseOptionalMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

export function clockifyImportFingerprint(row: ClockifyParsedRow): string {
  return [
    row.clientName,
    row.projectName,
    row.description,
    row.startedAt.toISOString(),
    row.endedAt.toISOString(),
    formatDurationHMM(row.durationMinutes),
    row.billable ? "1" : "0",
  ].join("|");
}
