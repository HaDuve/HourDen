import type { Client } from "@hourden/domain";
import { useCallback, useEffect, useRef, useState } from "react";

type IssuedInvoice = {
  id: string;
  recipient: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
};

function formatDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) {
    throw new Error(`Failed to load clients (${res.status})`);
  }
  const data = (await res.json()) as { clients: Client[] };
  return data.clients;
}

async function fetchIssuedInvoices(): Promise<IssuedInvoice[]> {
  const res = await fetch("/api/invoices");
  if (!res.ok) {
    throw new Error(`Failed to load invoices (${res.status})`);
  }
  const data = (await res.json()) as { invoices?: IssuedInvoice[] };
  return data.invoices ?? [];
}

function formatAmount(amount: number): string {
  return `${amount.toFixed(2)} EUR`;
}

function formatBillingPeriod(periodStart: string, periodEnd: string): string {
  return `${periodStart} – ${periodEnd}`;
}

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) {
      return data.error;
    }
  } catch {
    // Fall through to generic message.
  }
  return `Request failed (${res.status})`;
}

function downloadPdfBlob(blob: Blob, disposition: string) {
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "invoice.pdf";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function InvoicesPage() {
  const initialRange = currentMonthRange();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [issuedInvoices, setIssuedInvoices] = useState<IssuedInvoice[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportClientId, setExportClientId] = useState("");
  const [exportYear, setExportYear] = useState("");
  const [exporting, setExporting] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const clearPreviewBlob = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const clearPreview = useCallback(() => {
    clearPreviewBlob();
    setInvoiceNumber(null);
  }, [clearPreviewBlob]);

  const loadIssuedInvoices = useCallback(async () => {
    try {
      const invoices = await fetchIssuedInvoices();
      setIssuedInvoices(invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    }
  }, []);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchClients();
      setClients(loaded);
      if (loaded.length > 0) {
        setClientId((current) => current || loaded[0]!.id);
      }
      await loadIssuedInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [loadIssuedInvoices]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    clearPreview();
  }, [clientId, from, to, clearPreview]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  async function handlePreview() {
    if (!clientId) {
      setError("Select a Client before previewing");
      return;
    }

    setPreviewing(true);
    setError(null);
    clearPreview();

    try {
      const res = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, from, to }),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setInvoiceNumber(res.headers.get("X-Invoice-Number"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview invoice");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleIssue() {
    if (!clientId) {
      setError("Select a Client before issuing");
      return;
    }

    setIssuing(true);
    setError(null);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, from, to }),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      downloadPdfBlob(blob, disposition);
      setInvoiceNumber(res.headers.get("X-Invoice-Number"));
      clearPreviewBlob();
      await loadIssuedInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue invoice");
    } finally {
      setIssuing(false);
    }
  }

  async function handleExportOutgoing() {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (exportClientId) {
        params.set("client", exportClientId);
      }
      if (exportYear.trim()) {
        params.set("year", exportYear.trim());
      }

      const query = params.toString();
      const url = query
        ? `/api/invoices/export.zip?${query}`
        : "/api/invoices/export.zip";
      const res = await fetch(url);
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      downloadPdfBlob(blob, disposition);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export invoices");
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadIssued(invoice: IssuedInvoice) {
    setDownloadingId(invoice.id);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      downloadPdfBlob(blob, disposition);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={previewing || issuing || loading || !clientId}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            {previewing ? "Previewing…" : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => void handleIssue()}
            disabled={previewing || issuing || loading || !clientId || !previewUrl}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {issuing ? "Issuing…" : "Issue Invoice"}
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-neutral-700">
          Client
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={loading || clients.length === 0}
            className="rounded-md border border-neutral-300 px-3 py-2"
          >
            {clients.length === 0 ? (
              <option value="">No clients</option>
            ) : (
              clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {invoiceNumber ? (
        <p className="mb-4 text-sm text-neutral-700">
          Invoice Number: <span className="font-medium">{invoiceNumber}</span>
        </p>
      ) : null}

      {previewUrl ? (
        <iframe
          title="Invoice preview"
          src={previewUrl}
          className="h-[70vh] w-full rounded-md border border-neutral-200"
        />
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-medium text-slate-900">Issued Invoices</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[10rem] flex-col gap-1 text-sm text-neutral-700">
              Export client
              <select
                value={exportClientId}
                onChange={(e) => setExportClientId(e.target.value)}
                disabled={loading || clients.length === 0}
                className="rounded-md border border-neutral-300 px-3 py-2"
              >
                <option value="">All clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              Export year
              <input
                type="number"
                min={2000}
                max={2100}
                placeholder="All years"
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
                className="w-28 rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleExportOutgoing()}
              disabled={exporting || loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Export Outgoing.zip"}
            </button>
          </div>
        </div>
        {issuedInvoices.length === 0 ? (
          <p className="text-sm text-neutral-600">No issued invoices yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Invoice Number</th>
                  <th className="px-4 py-3 font-medium">Billing Period</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {issuedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-neutral-200">
                    <td className="px-4 py-3 text-neutral-900">{invoice.recipient}</td>
                    <td className="px-4 py-3 text-neutral-900">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatBillingPeriod(invoice.periodStart, invoice.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatAmount(invoice.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleDownloadIssued(invoice)}
                        disabled={downloadingId === invoice.id}
                        aria-label={`Download invoice ${invoice.invoiceNumber}`}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {downloadingId === invoice.id ? "Downloading…" : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
