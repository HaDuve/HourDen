export type ReportLineInput = {
  date: string;
  description: string;
  durationMinutes: number;
  amount: number;
};

export type GroupedReportLine = ReportLineInput;

export type ClientReportInput = ReportLineInput & {
  clientName: string;
};

export type ClientReport = {
  clientName: string;
  lines: GroupedReportLine[];
  totalDurationMinutes: number;
  totalAmount: number;
};

export function groupEntriesByDateAndDescription(
  entries: ReportLineInput[],
): GroupedReportLine[] {
  const grouped = new Map<string, GroupedReportLine>();

  for (const entry of entries) {
    const key = `${entry.date}\0${entry.description}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.durationMinutes += entry.durationMinutes;
      existing.amount = roundAmount(existing.amount + entry.amount);
    } else {
      grouped.set(key, { ...entry });
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.description.localeCompare(b.description);
  });
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildClientReport(entries: ClientReportInput[]): ClientReport[] {
  const byClient = new Map<string, ClientReportInput[]>();

  for (const entry of entries) {
    const clientName = entry.clientName || "(No Client)";
    const list = byClient.get(clientName) ?? [];
    list.push(entry);
    byClient.set(clientName, list);
  }

  return [...byClient.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clientName, clientEntries]) => {
      const lines = groupEntriesByDateAndDescription(
        clientEntries.map(({ date, description, durationMinutes, amount }) => ({
          date,
          description,
          durationMinutes,
          amount,
        })),
      );
      const totalDurationMinutes = lines.reduce(
        (sum, line) => sum + line.durationMinutes,
        0,
      );
      const totalAmount = roundAmount(
        lines.reduce((sum, line) => sum + line.amount, 0),
      );

      return {
        clientName,
        lines,
        totalDurationMinutes,
        totalAmount,
      };
    });
}
