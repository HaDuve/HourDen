export type DailyProjectSegment = {
  projectId: string | null;
  projectName: string | null;
  color: string | null;
  durationMinutes: number;
};

export type DailyBucketWithProjects = {
  date: string;
  durationMinutes: number;
  byProject: DailyProjectSegment[];
};

export type DailyProjectSeries = {
  key: string;
  name: string;
  color: string;
};

export type StackedDailyChartRow = {
  date: string;
  label: string;
  [projectKey: string]: string | number;
};

const UNASSIGNED_KEY = "__unassigned__";

export function projectSegmentKey(segment: Pick<DailyProjectSegment, "projectId">): string {
  return segment.projectId ?? UNASSIGNED_KEY;
}

/**
 * Pivot daily project segments into Recharts stacked-bar rows plus a stable
 * series list (largest total first) for legend and Bar children.
 */
export function buildStackedDailyChart(
  buckets: DailyBucketWithProjects[],
  formatLabel: (date: string) => string,
  unassignedLabel: string,
  fallbackColor: string,
): { rows: StackedDailyChartRow[]; series: DailyProjectSeries[] } {
  const totals = new Map<string, { name: string; color: string; minutes: number }>();

  for (const bucket of buckets) {
    for (const segment of bucket.byProject) {
      const key = projectSegmentKey(segment);
      const existing = totals.get(key);
      const name = segment.projectName ?? unassignedLabel;
      const color = segment.color ?? fallbackColor;
      if (existing) {
        existing.minutes += segment.durationMinutes;
      } else {
        totals.set(key, { name, color, minutes: segment.durationMinutes });
      }
    }
  }

  const series: DailyProjectSeries[] = [...totals.entries()]
    .sort((a, b) => b[1].minutes - a[1].minutes || a[1].name.localeCompare(b[1].name))
    .map(([key, value]) => ({
      key,
      name: value.name,
      color: value.color,
    }));

  const rows: StackedDailyChartRow[] = buckets.map((bucket) => {
    const row: StackedDailyChartRow = {
      date: bucket.date,
      label: formatLabel(bucket.date),
    };
    for (const s of series) {
      row[s.key] = 0;
    }
    for (const segment of bucket.byProject) {
      row[projectSegmentKey(segment)] = segment.durationMinutes;
    }
    return row;
  });

  return { rows, series };
}
