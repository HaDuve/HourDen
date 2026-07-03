import type { Client, InvoiceNumberingStrategy } from "@hourden/domain";
import { deriveDefaultInvoicePrefix, isValidAnyInvoiceNumber } from "@hourden/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import { DateRangeFilter } from "./DateRangeFilter.js";
import { currentMonthRange } from "./date-range.js";

type IssuedInvoice = {
  id: string;
  recipient: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
};

type NumberingPreview = {
  exists: boolean;
  suggestedNumber: string;
  nextIfIssued: {
    sequential: string;
    fromLast: string;
  };
};

function invoiceYearFromPeriodEnd(periodEnd: string): number {
  return Number(periodEnd.slice(0, 4));
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

async function fetchNumberingPreview(
  clientId: string,
  invoiceNumber: string,
  year: number,
  invoicePrefix: string,
  usePrefix: boolean,
): Promise<NumberingPreview> {
  const params = new URLSearchParams({
    clientId,
    invoiceNumber,
    year: String(year),
    invoicePrefix,
  });
  if (!usePrefix) {
    params.set("usePrefix", "false");
  }
  const res = await fetch(`/api/invoices/numbering-preview?${params}`);
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<NumberingPreview>;
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

function downloadAttachmentBlob(blob: Blob, disposition: string) {
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
  const [invoicePrefix, setInvoicePrefix] = useState<string | null>(null);
  const [suggestedInvoiceNumber, setSuggestedInvoiceNumber] = useState<
    string | null
  >(null);
  const [suggestedInvoicePrefix, setSuggestedInvoicePrefix] = useState<
    string | null
  >(null);
  const [invoiceNumberExists, setInvoiceNumberExists] = useState(false);
  const [numberingPreview, setNumberingPreview] = useState<NumberingPreview | null>(
    null,
  );
  const [numberingStrategy, setNumberingStrategy] =
    useState<InvoiceNumberingStrategy | null>(null);
  const [usePrefix, setUsePrefix] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [issuedInvoices, setIssuedInvoices] = useState<IssuedInvoice[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportClientId, setExportClientId] = useState("");
  const [exportYear, setExportYear] = useState("");
  const [exporting, setExporting] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef(0);
  const invoiceNumberDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const invoicePrefixDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
    setInvoicePrefix(null);
    setSuggestedInvoiceNumber(null);
    setSuggestedInvoicePrefix(null);
    setInvoiceNumberExists(false);
    setNumberingPreview(null);
    setNumberingStrategy(null);
    setUsePrefix(true);
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
      if (invoiceNumberDebounceRef.current) {
        clearTimeout(invoiceNumberDebounceRef.current);
      }
      if (invoicePrefixDebounceRef.current) {
        clearTimeout(invoicePrefixDebounceRef.current);
      }
    };
  }, []);

  const invoiceNumberEdited =
    invoiceNumber !== null &&
    suggestedInvoiceNumber !== null &&
    invoiceNumber !== suggestedInvoiceNumber;

  const refreshNumberingPreview = useCallback(
    async (nextInvoiceNumber: string, nextInvoicePrefix: string) => {
      if (!clientId || !suggestedInvoiceNumber) {
        return;
      }
      if (nextInvoiceNumber === suggestedInvoiceNumber) {
        setNumberingPreview(null);
        setNumberingStrategy(null);
        return;
      }

      try {
        const preview = await fetchNumberingPreview(
          clientId,
          nextInvoiceNumber,
          invoiceYearFromPeriodEnd(to),
          nextInvoicePrefix,
          usePrefix,
        );
        setNumberingPreview(preview);
        setNumberingStrategy((current) => current ?? "from_last");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load numbering preview",
        );
      }
    },
    [clientId, suggestedInvoiceNumber, to, usePrefix],
  );

  const requestPreview = useCallback(
    async (options?: {
      invoiceNumber?: string;
      invoicePrefix?: string;
      usePrefix?: boolean;
    }) => {
      if (!clientId) {
        setError("Select a Client before previewing");
        return;
      }

      const requestId = ++previewRequestIdRef.current;
      setPreviewing(true);
      setError(null);

      try {
        const body: {
          clientId: string;
          from: string;
          to: string;
          invoiceNumber?: string;
          invoicePrefix?: string;
          usePrefix?: boolean;
        } = { clientId, from, to };
        const nextUsePrefix = options?.usePrefix ?? usePrefix;
        if (!nextUsePrefix) {
          body.usePrefix = false;
        }
        if (options?.invoiceNumber) {
          body.invoiceNumber = options.invoiceNumber;
        }
        if (options?.invoicePrefix) {
          body.invoicePrefix = options.invoicePrefix;
        }

        const res = await fetch("/api/invoices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (requestId !== previewRequestIdRef.current) {
          return;
        }

        if (!res.ok) {
          setError(await readApiError(res));
          return;
        }

        const nextInvoiceNumber = res.headers.get("X-Invoice-Number");
        const nextSuggested = res.headers.get("X-Suggested-Invoice-Number");
        const nextPrefix =
          res.headers.get("X-Suggested-Invoice-Prefix") ??
          deriveDefaultInvoicePrefix(
            clients.find((client) => client.id === clientId)?.name ?? "",
          );
        const exists =
          res.headers.get("X-Invoice-Number-Exists") === "true";

        const blob = await res.blob();
        if (requestId !== previewRequestIdRef.current) {
          return;
        }

        clearPreviewBlob();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setInvoiceNumber(nextInvoiceNumber);
        setInvoicePrefix(nextPrefix);
        setSuggestedInvoiceNumber(nextSuggested);
        setSuggestedInvoicePrefix(nextPrefix);
        setInvoiceNumberExists(exists);

        if (
          nextInvoiceNumber &&
          nextSuggested &&
          nextInvoiceNumber !== nextSuggested &&
          nextPrefix
        ) {
          await refreshNumberingPreview(nextInvoiceNumber, nextPrefix);
        } else {
          setNumberingPreview(null);
          setNumberingStrategy(null);
        }
      } catch (err) {
        if (requestId === previewRequestIdRef.current) {
          setError(err instanceof Error ? err.message : "Failed to preview invoice");
        }
      } finally {
        if (requestId === previewRequestIdRef.current) {
          setPreviewing(false);
        }
      }
    },
    [clientId, clients, from, to, usePrefix, clearPreviewBlob, refreshNumberingPreview],
  );

  function handleUsePrefixChange(checked: boolean) {
    setUsePrefix(checked);
    setNumberingStrategy(null);
    setNumberingPreview(null);

    if (previewUrl) {
      void requestPreview({
        usePrefix: checked,
        invoiceNumber:
          invoiceNumber && invoiceNumber !== suggestedInvoiceNumber
            ? invoiceNumber
            : undefined,
        invoicePrefix: invoicePrefix ?? undefined,
      });
    }
  }

  async function handlePreview() {
    await requestPreview();
  }

  function handleInvoiceNumberChange(nextValue: string) {
    setInvoiceNumber(nextValue);
    setNumberingStrategy(null);

    const invoiceYear = invoiceYearFromPeriodEnd(to);
    const isCompleteNumber = isValidAnyInvoiceNumber(nextValue, invoiceYear);

    if (!isCompleteNumber) {
      setInvoiceNumberExists(false);
      setNumberingPreview(null);
    }

    if (invoiceNumberDebounceRef.current) {
      clearTimeout(invoiceNumberDebounceRef.current);
    }

    if (!isCompleteNumber) {
      return;
    }

    invoiceNumberDebounceRef.current = setTimeout(() => {
      void requestPreview({
        invoiceNumber: nextValue,
        invoicePrefix: invoicePrefix ?? undefined,
      });
    }, 300);
  }

  function handleInvoicePrefixChange(nextValue: string) {
    const normalized = nextValue.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setInvoicePrefix(normalized);
    setNumberingStrategy(null);
    setNumberingPreview(null);

    if (invoicePrefixDebounceRef.current) {
      clearTimeout(invoicePrefixDebounceRef.current);
    }

    if (!normalized) {
      return;
    }

    invoicePrefixDebounceRef.current = setTimeout(() => {
      void requestPreview({
        invoicePrefix: normalized,
        invoiceNumber:
          invoiceNumber && invoiceNumber !== suggestedInvoiceNumber
            ? invoiceNumber
            : undefined,
      });
    }, 300);
  }

  async function handleIssue() {
    if (!clientId) {
      setError("Select a Client before issuing");
      return;
    }
    if (!invoiceNumber) {
      setError("Preview the invoice before issuing");
      return;
    }
    if (invoiceNumberEdited && !numberingStrategy) {
      setError("Choose how future invoices should be numbered");
      return;
    }

    setIssuing(true);
    setError(null);

    try {
      const body: {
        clientId: string;
        from: string;
        to: string;
        invoiceNumber: string;
        invoicePrefix?: string;
        numberingStrategy?: InvoiceNumberingStrategy;
        usePrefix?: boolean;
      } = { clientId, from, to, invoiceNumber };
      if (!usePrefix) {
        body.usePrefix = false;
      }
      if (invoicePrefix) {
        body.invoicePrefix = invoicePrefix;
      }
      if (invoiceNumberEdited && numberingStrategy) {
        body.numberingStrategy = numberingStrategy;
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      downloadAttachmentBlob(blob, disposition);
      setInvoiceNumber(res.headers.get("X-Invoice-Number"));
      clearPreviewBlob();
      setSuggestedInvoiceNumber(null);
      setSuggestedInvoicePrefix(null);
      setInvoiceNumberExists(false);
      setNumberingPreview(null);
      setNumberingStrategy(null);
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
      downloadAttachmentBlob(blob, disposition);
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
      downloadAttachmentBlob(blob, disposition);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  }

  const issueDisabled =
    previewing ||
    issuing ||
    loading ||
    !clientId ||
    !previewUrl ||
    invoiceNumberExists ||
    (invoiceNumberEdited && !numberingStrategy);

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
            disabled={issueDisabled}
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
        <DateRangeFilter
          from={from}
          to={to}
          onChange={({ from: nextFrom, to: nextTo }) => {
            setFrom(nextFrom);
            setTo(nextTo);
          }}
        />
      </div>

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {invoiceNumber ? (
        <div className="mb-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              aria-label="Use prefix"
              checked={usePrefix}
              onChange={(e) => handleUsePrefixChange(e.target.checked)}
              disabled={previewing || issuing}
              className="rounded border-neutral-300"
            />
            Use prefix
          </label>

          <label className="flex max-w-xs flex-col gap-1 text-sm text-neutral-700">
            Invoice Prefix
            <input
              type="text"
              aria-label="Invoice Prefix"
              value={invoicePrefix ?? ""}
              onChange={(e) => handleInvoicePrefixChange(e.target.value)}
              disabled={previewing || issuing}
              className="rounded-md border border-neutral-300 px-3 py-2 font-medium uppercase text-neutral-900"
            />
          </label>

          <label className="flex max-w-xs flex-col gap-1 text-sm text-neutral-700">
            Invoice Number
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => handleInvoiceNumberChange(e.target.value)}
              disabled={previewing || issuing}
              className="rounded-md border border-neutral-300 px-3 py-2 font-medium text-neutral-900"
            />
          </label>

          {invoiceNumberExists ? (
            <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Invoice Number already exists in this Workspace.
            </p>
          ) : null}

          {invoiceNumberEdited && numberingPreview ? (
            <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
              <legend className="px-1 text-sm font-medium text-neutral-900">
                {usePrefix
                  ? `Future invoices for this Client in ${invoiceYearFromPeriodEnd(to)}`
                  : `Future plain invoices in this Workspace for ${invoiceYearFromPeriodEnd(to)}`}
              </legend>
              <div className="mt-2 space-y-2 text-sm text-neutral-700">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="numberingStrategy"
                    value="sequential"
                    checked={numberingStrategy === "sequential"}
                    onChange={() => setNumberingStrategy("sequential")}
                    className="mt-1"
                  />
                  <span>
                    Continue suggested sequence
                    <span className="mt-0.5 block text-neutral-500">
                      Next: {numberingPreview.nextIfIssued.sequential}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="numberingStrategy"
                    value="from_last"
                    checked={numberingStrategy === "from_last"}
                    onChange={() => setNumberingStrategy("from_last")}
                    className="mt-1"
                  />
                  <span>
                    Continue from this number
                    <span className="mt-0.5 block text-neutral-500">
                      Next: {numberingPreview.nextIfIssued.fromLast}
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          ) : null}
        </div>
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
