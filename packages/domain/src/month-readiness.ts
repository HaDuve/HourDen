import { toLocalDateKey } from "./clockify-csv.js";

export type MonthReadinessEntry = {
  id: string;
  clientId: string | null;
  startedAt: string;
  endedAt: string | null;
  amount: number | null;
  billableComplete: boolean;
  invoiced: boolean;
  description: string | null;
};

export type MonthReadinessClient = {
  id: string;
  name: string;
  hasRecipient: boolean;
};

export type MonthReadinessInvoice = {
  clientId: string;
  status: "issued" | "sent";
};

export type IncompleteReadinessEntry = {
  id: string;
  description: string | null;
  startedAt: string;
};

export type ClientMonthReadiness = {
  clientId: string;
  clientName: string;
  billableCompleteCount: number;
  stoppedEntryCount: number;
  unbilledAmount: number;
  invoiceStatus: "none" | "issued" | "sent";
  incompleteEntries: IncompleteReadinessEntry[];
  missingRecipient: boolean;
};

export type MonthReadinessSummary = {
  from: string;
  to: string;
  invoiceSenderConfigured: boolean;
  monthClosed: boolean;
  clients: ClientMonthReadiness[];
};

type MonthReadinessInput = {
  entries: MonthReadinessEntry[];
  clients: MonthReadinessClient[];
  invoices: MonthReadinessInvoice[];
  invoiceSenderConfigured: boolean;
};

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortPriority(row: ClientMonthReadiness): number {
  const hasBlockers =
    row.missingRecipient || row.incompleteEntries.length > 0;
  if (hasBlockers) return 0;
  if (row.invoiceStatus === "none" && row.billableCompleteCount > 0) return 1;
  if (row.invoiceStatus === "none") return 2;
  return 3;
}

/**
 * Per-Client invoice readiness for a Billing Period: text counts, unbilled
 * amount, existing Invoice status, and in-place fix targets (incomplete
 * Descriptions, missing Recipient). Sorted blockers/incomplete first.
 */
export function summarizeMonthReadiness(
  input: MonthReadinessInput,
  options: { monthKey: string; timeZone: string; from: string; to: string },
): MonthReadinessSummary {
  const clientById = new Map(input.clients.map((c) => [c.id, c]));
  const invoiceByClient = new Map(
    input.invoices.map((invoice) => [invoice.clientId, invoice.status]),
  );

  type Acc = {
    billableCompleteCount: number;
    stoppedEntryCount: number;
    unbilledAmount: number;
    incompleteEntries: IncompleteReadinessEntry[];
  };

  const byClient = new Map<string, Acc>();

  for (const entry of input.entries) {
    if (!entry.clientId) continue;

    const dateKey = toLocalDateKey(new Date(entry.startedAt), options.timeZone);
    if (!dateKey.startsWith(options.monthKey)) continue;

    if (entry.endedAt === null) continue;

    const client = clientById.get(entry.clientId);
    if (!client) continue;

    let acc = byClient.get(entry.clientId);
    if (!acc) {
      acc = {
        billableCompleteCount: 0,
        stoppedEntryCount: 0,
        unbilledAmount: 0,
        incompleteEntries: [],
      };
      byClient.set(entry.clientId, acc);
    }

    acc.stoppedEntryCount += 1;

    if (entry.billableComplete) {
      acc.billableCompleteCount += 1;
      if (!entry.invoiced) {
        acc.unbilledAmount += entry.amount ?? 0;
      }
      continue;
    }

    if (!entry.invoiced) {
      acc.incompleteEntries.push({
        id: entry.id,
        description: entry.description,
        startedAt: entry.startedAt,
      });
    }
  }

  const clients: ClientMonthReadiness[] = [...byClient.entries()].map(
    ([clientId, acc]) => {
      const client = clientById.get(clientId)!;
      const invoiceStatus = invoiceByClient.get(clientId) ?? "none";
      return {
        clientId,
        clientName: client.name,
        billableCompleteCount: acc.billableCompleteCount,
        stoppedEntryCount: acc.stoppedEntryCount,
        unbilledAmount: roundAmount(acc.unbilledAmount),
        invoiceStatus,
        incompleteEntries: acc.incompleteEntries,
        missingRecipient: !client.hasRecipient,
      };
    },
  );

  clients.sort((a, b) => {
    const priorityCmp = sortPriority(a) - sortPriority(b);
    if (priorityCmp !== 0) return priorityCmp;
    return a.clientName.localeCompare(b.clientName);
  });

  const monthClosed = clients
    .filter((row) => row.billableCompleteCount > 0)
    .every((row) => row.invoiceStatus === "issued" || row.invoiceStatus === "sent");

  return {
    from: options.from,
    to: options.to,
    invoiceSenderConfigured: input.invoiceSenderConfigured,
    monthClosed,
    clients,
  };
}
