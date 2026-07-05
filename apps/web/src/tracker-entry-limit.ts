export const TRACKER_ENTRY_LIMITS = [50, 100, 200] as const;

export type TrackerEntryLimit = (typeof TRACKER_ENTRY_LIMITS)[number];

export const DEFAULT_TRACKER_ENTRY_LIMIT: TrackerEntryLimit = 50;

const STORAGE_KEY = "hourden.tracker-entry-limit";
const LEGACY_STORAGE_KEY = "hourden.recent-entry-limit";

export function readStoredTrackerEntryLimit(): TrackerEntryLimit {
  if (typeof localStorage === "undefined") {
    return DEFAULT_TRACKER_ENTRY_LIMIT;
  }

  const stored =
    localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  const parsed = Number(stored);
  if (TRACKER_ENTRY_LIMITS.includes(parsed as TrackerEntryLimit)) {
    return parsed as TrackerEntryLimit;
  }
  return DEFAULT_TRACKER_ENTRY_LIMIT;
}

export function storeTrackerEntryLimit(limit: TrackerEntryLimit): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, String(limit));
}
