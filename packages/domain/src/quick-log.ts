import { toLocalDateKey } from "./clockify-csv.js";
import { addCalendarDays, instantAtLocal } from "./day-ribbon.js";
import { computeLiveEarnings } from "./money-clock.js";

export type QuickLogProjectCandidate = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  defaultRate: number;
};

export type QuickLogParseContext = {
  projects: QuickLogProjectCandidate[];
  now: Date;
  timeZone: string;
  /** Resolve an ambiguous project match after the Operator picks from the list. */
  selectedProjectId?: string;
};

export type QuickLogNavigateDestination =
  | "tracker"
  | "dashboard"
  | "invoices"
  | "clients"
  | "projects"
  | "report"
  | "import";

export type QuickLogMissing =
  | "duration_or_range"
  | "description"
  | "project";

type QuickLogBase = {
  commitable: boolean;
};

export type QuickLogResult =
  | (QuickLogBase & { kind: "empty" })
  | (QuickLogBase & { kind: "stop" })
  | (QuickLogBase & {
      kind: "navigate";
      destination: QuickLogNavigateDestination;
    })
  | (QuickLogBase & {
      kind: "incomplete";
      missing: QuickLogMissing[];
    })
  | (QuickLogBase & {
      kind: "start";
      projectId: string | null;
      projectName: string | null;
      clientName: string | null;
      description: string | null;
      candidates?: QuickLogProjectCandidate[];
    })
  | (QuickLogBase & {
      kind: "manual";
      startedAt: string;
      endedAt: string;
      durationMinutes: number;
      projectId: string | null;
      projectName: string | null;
      clientName: string | null;
      description: string | null;
      amountPreview: number | null;
      dateKey: string;
      candidates?: QuickLogProjectCandidate[];
    });

const NAV_DESTINATIONS: Record<string, QuickLogNavigateDestination> = {
  tracker: "tracker",
  today: "tracker",
  dashboard: "dashboard",
  invoices: "invoices",
  invoice: "invoices",
  clients: "clients",
  client: "clients",
  projects: "projects",
  project: "projects",
  report: "report",
  reports: "report",
  import: "import",
  // German
  rechnungen: "invoices",
  rechnung: "invoices",
  kunden: "clients",
  projekte: "projects",
  bericht: "report",
  berichte: "report",
  importieren: "import",
};

const STOP_WORDS = new Set(["stop", "stopp", "stoppen"]);
const START_WORDS = new Set(["start", "starten", "starte"]);

const DATE_OFFSET: Record<string, number> = {
  today: 0,
  heute: 0,
  yesterday: -1,
  gestern: -1,
  tomorrow: 1,
  morgen: 1,
};

const DURATION_RE =
  /^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|std|stunde|stunden|m|min|mins|minute|minutes)$/i;
const RANGE_RE =
  /^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/;

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[.,;:!?]+$/g, "");
}

function parseDurationMinutes(token: string): number | null {
  const match = DURATION_RE.exec(token.trim());
  if (!match) return null;
  const value = Number(match[1]!.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2]!.toLowerCase();
  if (unit.startsWith("m")) {
    return Math.round(value);
  }
  return Math.round(value * 60);
}

function parseTimeRange(
  token: string,
): { startHour: number; startMinute: number; endHour: number; endMinute: number } | null {
  const match = RANGE_RE.exec(token.trim());
  if (!match) return null;
  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if (
    startHour > 23 ||
    endHour > 23 ||
    startMinute > 59 ||
    endMinute > 59
  ) {
    return null;
  }
  return { startHour, startMinute, endHour, endMinute };
}

function scoreNameMatch(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (q === n) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  // Token-wise: all query words appear in name
  const qParts = q.split(/\s+/).filter(Boolean);
  if (qParts.length > 1 && qParts.every((part) => n.includes(part))) {
    return 70;
  }
  return 0;
}

function matchProjects(
  tokens: string[],
  projects: QuickLogProjectCandidate[],
): {
  matched: QuickLogProjectCandidate[];
  consumed: number;
} {
  if (tokens.length === 0 || projects.length === 0) {
    return { matched: [], consumed: 0 };
  }

  let bestConsumed = 0;
  let bestLenScore = 0;
  let bestMatches: QuickLogProjectCandidate[] = [];

  const maxLen = Math.min(tokens.length, 4);
  for (let len = maxLen; len >= 1; len--) {
    const phrase = tokens.slice(0, len).join(" ");
    const scored = projects
      .map((project) => {
        const projectScore = scoreNameMatch(phrase, project.name);
        const clientScore = scoreNameMatch(phrase, project.clientName);
        return { project, score: Math.max(projectScore, clientScore) };
      })
      .filter((entry) => entry.score >= 60);

    if (scored.length === 0) continue;

    // Longer phrases win (e.g. "ondojo api" over "ondojo").
    const lenScore = len * 100;
    if (lenScore > bestLenScore) {
      bestLenScore = lenScore;
      bestConsumed = len;
      bestMatches = scored.map((entry) => entry.project);
    }
  }

  return { matched: bestMatches, consumed: bestConsumed };
}

function resolveProject(
  matched: QuickLogProjectCandidate[],
  selectedProjectId: string | undefined,
): {
  project: QuickLogProjectCandidate | null;
  candidates?: QuickLogProjectCandidate[];
  ambiguous: boolean;
} {
  if (matched.length === 0) {
    return { project: null, ambiguous: false };
  }
  if (selectedProjectId) {
    const selected = matched.find((p) => p.id === selectedProjectId);
    if (selected) {
      return { project: selected, ambiguous: false };
    }
  }
  if (matched.length === 1) {
    return { project: matched[0]!, ambiguous: false };
  }
  return { project: null, candidates: matched, ambiguous: true };
}

function localParts(
  date: Date,
  timeZone: string,
): { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function parseNavigate(trimmed: string): QuickLogResult | null {
  const match = /^(?:go\s+to|goto|gehe\s+zu|öffne|oeffne)\s+(.+)$/i.exec(trimmed);
  if (!match) return null;
  const destKey = normalizeToken(match[1]!.trim());
  const destination = NAV_DESTINATIONS[destKey];
  if (!destination) return null;
  return { kind: "navigate", destination, commitable: true };
}

function projectFields(project: QuickLogProjectCandidate | null): {
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
} {
  if (!project) {
    return { projectId: null, projectName: null, clientName: null };
  }
  return {
    projectId: project.id,
    projectName: project.name,
    clientName: project.clientName,
  };
}

/**
 * Parse a Quick Log one-liner into a previewable / commitable action.
 * Project matching is fuzzy over Project and Client names.
 */
export function parseQuickLog(
  input: string,
  context: QuickLogParseContext,
): QuickLogResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: "empty", commitable: false };
  }

  const navigate = parseNavigate(trimmed);
  if (navigate) return navigate;

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  const normalizedFirst = normalizeToken(rawTokens[0] ?? "");

  if (rawTokens.length === 1 && STOP_WORDS.has(normalizedFirst)) {
    return { kind: "stop", commitable: true };
  }

  let tokens = [...rawTokens];
  let isStart = false;

  if (START_WORDS.has(normalizeToken(tokens[0] ?? ""))) {
    isStart = true;
    tokens = tokens.slice(1);
  }

  let durationMinutes: number | null = null;
  let range: ReturnType<typeof parseTimeRange> = null;
  let dayOffset = 0;
  const remainder: string[] = [];

  for (const token of tokens) {
    const norm = normalizeToken(token);
    if (DATE_OFFSET[norm] !== undefined) {
      dayOffset = DATE_OFFSET[norm]!;
      continue;
    }

    const asDuration = parseDurationMinutes(token);
    if (asDuration !== null && durationMinutes === null && range === null) {
      durationMinutes = asDuration;
      continue;
    }

    const asRange = parseTimeRange(token);
    if (asRange && range === null && durationMinutes === null) {
      range = asRange;
      continue;
    }

    // Two-token duration: "2" + "std" / "2" + "stunden"
    remainder.push(token);
  }

  // Re-scan remainder for split duration tokens ("2" "std")
  const cleanedRemainder: string[] = [];
  for (let i = 0; i < remainder.length; i++) {
    const current = remainder[i]!;
    const next = remainder[i + 1];
    if (next) {
      const combined = `${current}${next}`;
      const spaced = `${current} ${next}`;
      const asDuration =
        parseDurationMinutes(combined) ?? parseDurationMinutes(spaced);
      if (asDuration !== null && durationMinutes === null && range === null) {
        durationMinutes = asDuration;
        i += 1;
        continue;
      }
    }
    cleanedRemainder.push(current);
  }

  const { matched, consumed } = matchProjects(cleanedRemainder, context.projects);
  const descriptionTokens = cleanedRemainder.slice(consumed);
  const description =
    descriptionTokens.length > 0 ? descriptionTokens.join(" ") : null;

  const { project, candidates, ambiguous } = resolveProject(
    matched,
    context.selectedProjectId,
  );

  if (isStart) {
    if (!description && !project && !ambiguous) {
      return {
        kind: "incomplete",
        missing: ["description"],
        commitable: false,
      };
    }
    return {
      kind: "start",
      ...projectFields(project),
      description,
      ...(ambiguous
        ? { candidates, commitable: false }
        : { commitable: true }),
    };
  }

  if (durationMinutes === null && range === null) {
    return {
      kind: "incomplete",
      missing: ["duration_or_range"],
      commitable: false,
    };
  }

  if (!description) {
    return {
      kind: "incomplete",
      missing: ["description"],
      commitable: false,
    };
  }

  const todayKey = toLocalDateKey(context.now, context.timeZone);
  const dateKey = addCalendarDays(todayKey, dayOffset);
  const nowParts = localParts(context.now, context.timeZone);

  let startedAtMs: number;
  let endedAtMs: number;

  if (range) {
    startedAtMs = instantAtLocal(
      dateKey,
      range.startHour,
      range.startMinute,
      0,
      context.timeZone,
    );
    endedAtMs = instantAtLocal(
      dateKey,
      range.endHour,
      range.endMinute,
      0,
      context.timeZone,
    );
    if (endedAtMs <= startedAtMs) {
      return {
        kind: "incomplete",
        missing: ["duration_or_range"],
        commitable: false,
      };
    }
    durationMinutes = Math.round((endedAtMs - startedAtMs) / 60_000);
  } else {
    endedAtMs = instantAtLocal(
      dateKey,
      nowParts.hour,
      nowParts.minute,
      nowParts.second,
      context.timeZone,
    );
    startedAtMs = endedAtMs - durationMinutes! * 60_000;
  }

  const amountPreview =
    project && durationMinutes!
      ? computeLiveEarnings(durationMinutes! * 60, project.defaultRate)
      : null;

  return {
    kind: "manual",
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationMinutes: durationMinutes!,
    ...projectFields(project),
    description,
    amountPreview,
    dateKey,
    ...(ambiguous
      ? { candidates, commitable: false }
      : { commitable: true }),
  };
}
