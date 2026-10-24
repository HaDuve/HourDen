import { toLocalDateKey } from "./clockify-csv.js";

/** Elapsed seconds × hourly Billable Rate, rounded to cents like stored amounts. */
export function computeLiveEarnings(
  elapsedSeconds: number,
  hourlyRate: number,
): number {
  if (elapsedSeconds <= 0 || hourlyRate <= 0) {
    return 0;
  }
  return Math.round((elapsedSeconds / 3600) * hourlyRate * 100) / 100;
}

export type UnbilledMonthEntry = {
  startedAt: string;
  endedAt: string | null;
  amount: number | null;
  billableComplete: boolean;
  invoiced: boolean;
};

export type UnbilledMonthSummary = {
  totalAmount: number;
  incompleteCount: number;
};

/**
 * Unbilled this month: sum of Billable Complete, not-yet-invoiced amounts whose
 * start falls in `monthKey` (YYYY-MM) in the Workspace Calendar Timezone, plus
 * a count of stopped incomplete entries that invoicing would exclude.
 */
export function summarizeUnbilledMonth(
  entries: UnbilledMonthEntry[],
  options: { monthKey: string; timeZone: string },
): UnbilledMonthSummary {
  let totalAmount = 0;
  let incompleteCount = 0;

  for (const entry of entries) {
    const dateKey = toLocalDateKey(new Date(entry.startedAt), options.timeZone);
    if (!dateKey.startsWith(options.monthKey)) {
      continue;
    }

    if (entry.billableComplete && !entry.invoiced) {
      totalAmount += entry.amount ?? 0;
      continue;
    }

    if (entry.endedAt !== null && !entry.billableComplete && !entry.invoiced) {
      incompleteCount += 1;
    }
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    incompleteCount,
  };
}
