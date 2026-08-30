import type { Client, InvoiceNumberingStrategy } from "@hourden/domain";
import { deriveDefaultInvoicePrefix, isValidAnyInvoiceNumber } from "@hourden/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleFormat } from "./locale/use-locale-format.js";
import { DateRangeFilter } from "./DateRangeFilter.js";
import { currentMonthRange } from "./date-range.js";
import { InvoicePreviewPane } from "./invoices/InvoicePreviewPane.js";
import type { InvoiceAlert } from "./invoices/invoice-alert.js";
import { InvoiceAlertBanner } from "./invoices/InvoiceAlertBanner.js";
import {
  fillInvoiceEmailTemplate,
  invoiceEmailPlaceholderLiterals,
  invoiceEmailPlaceholderVars,
  resolveInvoiceEmailTemplates,
} from "./invoices/invoice-email-template.js";
import { buildMailtoHref } from "./invoices/open-mailto.js";
import { deliverPrepareEmail } from "./invoices/prepare-email-delivery.js";
import {
  readApiErrorBody,
  readApiErrorMessage,
} from "./invoices/read-api-error.js";
import { IssuedInvoicesList, type IssuedInvoice } from "./layout/IssuedInvoicesList.js";
import { InvoicePdfToolbar } from "./layout/InvoicePdfToolbar.js";
import { PageMain } from "./layout/PageMain.js";
import { ResponsiveOverlay } from "./layout/ResponsiveOverlay.js";
import {
  mobilePrimaryButtonClass,
  mobileSecondaryButtonClass,
} from "./layout/tap-targets.js";
import {
  emptyStateClass,
  fieldLabelClass,
  inputClass,
  metaTextClass,
  pageTitleClass,
  pageSubtitleClass,
  panelClass,
  selectClass,
} from "./layout/ui-classes.js";
import { useIsMobile } from "./layout/use-is-mobile.js";

type NumberingPreview = {
  exists: boolean;
  suggestedNumber: string;
  nextIfIssued: {
    sequential: string;
    fromLast: string;
  };
};

type InvoiceSender = {
  name: string;
  street: string;
  city: string;
  taxNumber: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  bic: string;
};

type InvoiceSenderFormData = {
  name: string;
  street: string;
  city: string;
  taxNumber: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  bic: string;
};

const emptyInvoiceSenderForm: InvoiceSenderFormData = {
  name: "",
  street: "",
  city: "",
  taxNumber: "",
  email: "",
  phone: "",
  bankName: "",
  iban: "",
  bic: "",
};

function invoiceSenderToForm(sender: InvoiceSender): InvoiceSenderFormData {
  return {
    name: sender.name,
    street: sender.street,
    city: sender.city,
    taxNumber: sender.taxNumber,
    email: sender.email,
    phone: sender.phone,
    bankName: sender.bankName,
    iban: sender.iban,
    bic: sender.bic,
  };
}

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

async function fetchInvoiceSenderStatus(): Promise<{
  invoiceSender: InvoiceSender;
  configured: boolean;
}> {
  const res = await fetch("/api/workspace/invoice-sender");
  if (!res.ok) {
    throw new Error(`Failed to load invoice sender (${res.status})`);
  }
  return res.json() as Promise<{
    invoiceSender: InvoiceSender;
    configured: boolean;
  }>;
}

async function saveInvoiceSender(
  form: InvoiceSenderFormData,
): Promise<{ invoiceSender: InvoiceSender; configured: boolean }> {
  const res = await fetch("/api/workspace/invoice-sender", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res));
  }
  return res.json() as Promise<{
    invoiceSender: InvoiceSender;
    configured: boolean;
  }>;
}

async function fetchNumberingPreview(
  clientId: string,
  invoiceNumber: string,
  year: number,
  invoicePrefix: string,
  usePrefix: boolean,
  invoiceNumberSeqBeforeYear: boolean,
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
  if (invoiceNumberSeqBeforeYear) {
    params.set("invoiceNumberSeqBeforeYear", "true");
  }
  const res = await fetch(`/api/invoices/numbering-preview?${params}`);
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res));
  }
  return res.json() as Promise<NumberingPreview>;
}

function parseContentDispositionFilename(disposition: string): string | null {
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1];
  return filename ? filename : null;
}

function downloadAttachmentBlob(blob: Blob, disposition: string) {
  const filename =
    parseContentDispositionFilename(disposition) ?? "invoice.pdf";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Chrome's PDF viewer names blob: downloads after the UUID; hide its toolbar. */
function previewIframeSrc(blobUrl: string): string {
  return `${blobUrl}#toolbar=0`;
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const { formatCurrency, formatIsoDate, locale } = useLocaleFormat();
  const formatBillingPeriod = (periodStart: string, periodEnd: string) =>
    `${formatIsoDate(periodStart)} – ${formatIsoDate(periodEnd)}`;
  const initialRange = currentMonthRange();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<InvoiceAlert | null>(null);
  const [previewAlert, setPreviewAlert] = useState<InvoiceAlert | null>(null);
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
  const [invoiceNumberSeqBeforeYear, setInvoiceNumberSeqBeforeYear] =
    useState(false);
  const [usesSmallBusinessRule, setUsesSmallBusinessRule] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFullscreenOpen, setPreviewFullscreenOpen] = useState(false);
  const [issuedInvoices, setIssuedInvoices] = useState<IssuedInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportClientId, setExportClientId] = useState("");
  const [exportYear, setExportYear] = useState("");
  const [exporting, setExporting] = useState(false);
  const [editingSender, setEditingSender] = useState(false);
  const [senderForm, setSenderForm] = useState<InvoiceSenderFormData>(
    emptyInvoiceSenderForm,
  );
  const [loadingSender, setLoadingSender] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  const [invoiceSenderConfigured, setInvoiceSenderConfigured] = useState(true);
  const [invoiceSenderName, setInvoiceSenderName] = useState("");
  const previewUrlRef = useRef<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);
  const previewFilenameRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef(0);
  const invoiceNumberDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const invoicePrefixDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const setPlainAlert = useCallback((message: string) => {
    setAlert({ kind: "plain", message });
  }, []);

  const applyPreviewApiError = useCallback(
    async (res: Response, options?: { clientId?: string }) => {
      const apiError = await readApiErrorBody(res);
      if (apiError.code) {
        setPreviewAlert({
          kind: "blocker",
          code: apiError.code,
          clientId: options?.clientId,
        });
        return;
      }
      setPreviewAlert({ kind: "plain", message: apiError.message });
    },
    [],
  );

  const applyApiErrorAlert = useCallback(
    async (res: Response, options?: { clientId?: string }) => {
      const apiError = await readApiErrorBody(res);
      if (apiError.code) {
        setAlert({
          kind: "blocker",
          code: apiError.code,
          clientId: options?.clientId,
        });
        return;
      }
      setAlert({ kind: "plain", message: apiError.message });
    },
    [],
  );

  const clearPreviewBlob = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    previewBlobRef.current = null;
    previewFilenameRef.current = null;
    setPreviewUrl(null);
    setPreviewFullscreenOpen(false);
  }, []);

  const clearPreview = useCallback(() => {
    clearPreviewBlob();
    setPreviewAlert(null);
    setInvoiceNumber(null);
    setInvoicePrefix(null);
    setSuggestedInvoiceNumber(null);
    setSuggestedInvoicePrefix(null);
    setInvoiceNumberExists(false);
    setNumberingPreview(null);
    setNumberingStrategy(null);
    setUsePrefix(true);
  }, [clearPreviewBlob]);

  const clearPreviewResult = useCallback(() => {
    clearPreviewBlob();
    setInvoiceNumber(null);
    setInvoicePrefix(null);
    setSuggestedInvoiceNumber(null);
    setSuggestedInvoicePrefix(null);
    setInvoiceNumberExists(false);
    setNumberingPreview(null);
    setNumberingStrategy(null);
  }, [clearPreviewBlob]);

  const loadIssuedInvoices = useCallback(async () => {
    try {
      const invoices = await fetchIssuedInvoices();
      setIssuedInvoices(invoices);
      setSelectedInvoiceId((current) => {
        if (current && invoices.some((inv) => inv.id === current)) return current;
        return invoices[0]?.id ?? null;
      });
    } catch (err) {
      setPlainAlert(t("invoices.loadInvoicesFailed"));
    }
  }, [setPlainAlert, t]);

  const loadInvoiceSenderStatus = useCallback(async () => {
    try {
      const status = await fetchInvoiceSenderStatus();
      setInvoiceSenderConfigured(status.configured);
      setInvoiceSenderName(status.invoiceSender.name);
    } catch (err) {
      setPlainAlert(t("invoices.loadInvoiceSenderFailed"));
    }
  }, [t]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const loaded = await fetchClients();
      setClients(loaded);
      if (loaded.length > 0) {
        setClientId((current) => current || loaded[0]!.id);
      } else {
        setPreviewAlert({ kind: "blocker", code: "NO_CLIENTS" });
      }
      await Promise.all([loadIssuedInvoices(), loadInvoiceSenderStatus()]);
    } catch (err) {
      setPlainAlert(t("invoices.loadClientsFailed"));
    } finally {
      setLoading(false);
    }
  }, [loadIssuedInvoices, loadInvoiceSenderStatus, t]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    const selectedClient = clients.find((client) => client.id === clientId);
    setInvoiceNumberSeqBeforeYear(
      selectedClient?.invoiceNumberSeqBeforeYear ?? false,
    );
  }, [clientId, clients]);

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
          invoiceNumberSeqBeforeYear,
        );
        setNumberingPreview(preview);
        setNumberingStrategy((current) => current ?? "from_last");
      } catch {
        setPlainAlert(t("invoices.loadNumberingPreviewFailed"));
      }
    },
    [clientId, suggestedInvoiceNumber, to, usePrefix, invoiceNumberSeqBeforeYear, t],
  );

  const openSenderEditor = useCallback(async () => {
    setEditingSender(true);
    setLoadingSender(true);
    setAlert(null);

    try {
      const status = await fetchInvoiceSenderStatus();
      setSenderForm(invoiceSenderToForm(status.invoiceSender));
    } catch (err) {
      setEditingSender(false);
      setPlainAlert(t("invoices.loadInvoiceSenderFailed"));
    } finally {
      setLoadingSender(false);
    }
  }, [t]);

  const requestPreview = useCallback(
    async (options?: {
      invoiceNumber?: string;
      invoicePrefix?: string;
      usePrefix?: boolean;
      invoiceNumberSeqBeforeYear?: boolean;
      usesSmallBusinessRule?: boolean;
    }) => {
      if (!clientId) {
        return;
      }

      const requestId = ++previewRequestIdRef.current;
      setPreviewing(true);
      setPreviewAlert(null);

      try {
        const body: {
          clientId: string;
          from: string;
          to: string;
          invoiceNumber?: string;
          invoicePrefix?: string;
          usePrefix?: boolean;
          invoiceNumberSeqBeforeYear?: boolean;
          usesSmallBusinessRule?: boolean;
        } = { clientId, from, to };
        const nextUsePrefix = options?.usePrefix ?? usePrefix;
        const nextInvoiceNumberSeqBeforeYear =
          options?.invoiceNumberSeqBeforeYear ?? invoiceNumberSeqBeforeYear;
        const nextUsesSmallBusinessRule =
          options?.usesSmallBusinessRule ?? usesSmallBusinessRule;
        if (!nextUsePrefix) {
          body.usePrefix = false;
        }
        if (nextInvoiceNumberSeqBeforeYear) {
          body.invoiceNumberSeqBeforeYear = true;
        }
        if (!nextUsesSmallBusinessRule) {
          body.usesSmallBusinessRule = false;
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
          clearPreviewResult();
          await applyPreviewApiError(res, { clientId });
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

        const disposition = res.headers.get("Content-Disposition") ?? "";
        const filename =
          parseContentDispositionFilename(disposition) ?? "invoice.pdf";

        clearPreviewBlob();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        previewBlobRef.current = blob;
        previewFilenameRef.current = filename;
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
          clearPreviewResult();
          setPreviewAlert({
            kind: "plain",
            message: t("invoices.previewFailed"),
            canRetry: true,
          });
        }
      } finally {
        if (requestId === previewRequestIdRef.current) {
          setPreviewing(false);
        }
      }
    },
    [
      clientId,
      clients,
      from,
      to,
      usePrefix,
      invoiceNumberSeqBeforeYear,
      usesSmallBusinessRule,
      clearPreviewBlob,
      clearPreviewResult,
      refreshNumberingPreview,
      applyPreviewApiError,
      t,
    ],
  );

  const requestPreviewRef = useRef(requestPreview);
  requestPreviewRef.current = requestPreview;

  useEffect(() => {
    clearPreview();
    if (!loading && clientId) {
      void requestPreviewRef.current();
    }
  }, [clientId, from, to, loading, clearPreview]);

  function handleInvoiceNumberSeqBeforeYearChange(checked: boolean) {
    setInvoiceNumberSeqBeforeYear(checked);
    setNumberingStrategy(null);
    setNumberingPreview(null);

    if (clientId) {
      void requestPreview({
        invoiceNumberSeqBeforeYear: checked,
        invoiceNumber:
          invoiceNumber && invoiceNumber !== suggestedInvoiceNumber
            ? invoiceNumber
            : undefined,
        invoicePrefix: invoicePrefix ?? undefined,
      });
    }
  }

  function handleUsesSmallBusinessRuleChange(checked: boolean) {
    setUsesSmallBusinessRule(checked);

    if (clientId) {
      void requestPreview({ usesSmallBusinessRule: checked });
    }
  }

  function handleUsePrefixChange(checked: boolean) {
    setUsePrefix(checked);
    setNumberingStrategy(null);
    setNumberingPreview(null);

    if (clientId) {
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

  async function handleRetryPreview() {
    await requestPreview();
  }

  function handleDownloadPreview() {
    const blob = previewBlobRef.current;
    const filename = previewFilenameRef.current;
    if (!blob || !filename) {
      return;
    }
    downloadAttachmentBlob(blob, `attachment; filename="${filename}"`);
  }

  useEffect(() => {
    if (!previewFullscreenOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewFullscreenOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewFullscreenOpen]);

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
      setPlainAlert(t("invoices.selectClientBeforeIssue"));
      return;
    }
    if (!invoiceNumber) {
      setPlainAlert(t("invoices.previewBeforeIssue"));
      return;
    }
    if (!invoiceSenderConfigured) {
      setPlainAlert(t("invoices.setupInvoiceSenderBeforeIssue"));
      void openSenderEditor();
      return;
    }
    if (invoiceNumberEdited && !numberingStrategy) {
      setPlainAlert(t("invoices.chooseNumberingStrategy"));
      return;
    }

    setIssuing(true);
    setAlert(null);

    try {
      const body: {
        clientId: string;
        from: string;
        to: string;
        invoiceNumber: string;
        invoicePrefix?: string;
        numberingStrategy?: InvoiceNumberingStrategy;
        usePrefix?: boolean;
        invoiceNumberSeqBeforeYear?: boolean;
        usesSmallBusinessRule?: boolean;
      } = { clientId, from, to, invoiceNumber };
      if (!usePrefix) {
        body.usePrefix = false;
      }
      if (invoiceNumberSeqBeforeYear) {
        body.invoiceNumberSeqBeforeYear = true;
      }
      if (!usesSmallBusinessRule) {
        body.usesSmallBusinessRule = false;
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
        await applyApiErrorAlert(res, { clientId });
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
      setPlainAlert(t("invoices.issueFailed"));
    } finally {
      setIssuing(false);
    }
  }

  async function handleExportOutgoing() {
    setExporting(true);
    setAlert(null);

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
        await applyApiErrorAlert(res, { clientId });
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      downloadAttachmentBlob(blob, disposition);
    } catch (err) {
      setPlainAlert(t("invoices.exportInvoicesFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadIssued(invoice: IssuedInvoice) {
    setDownloadingId(invoice.id);
    setAlert(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (!res.ok) {
        await applyApiErrorAlert(res, { clientId });
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      downloadAttachmentBlob(blob, disposition);
    } catch (err) {
      setPlainAlert(t("invoices.downloadInvoiceFailed"));
    } finally {
      setDownloadingId(null);
    }
  }

  const loadClientMail = useCallback(async (mailClientId: string) => {
    const res = await fetch(`/api/clients/${mailClientId}`);
    if (!res.ok) {
      throw new Error(await readApiErrorMessage(res));
    }
    const client = (await res.json()) as Client;
    return {
      recipientEmail: client.recipientEmail,
      emailGreetingName: client.emailGreetingName,
      invoiceEmailSubject: client.invoiceEmailSubject,
      invoiceEmailBody: client.invoiceEmailBody,
    };
  }, []);

  const loadWorkspaceTemplate = useCallback(async () => {
    const res = await fetch("/api/workspace/invoice-email-template");
    if (!res.ok) {
      throw new Error(await readApiErrorMessage(res));
    }
    return res.json() as Promise<{
      invoiceEmailSubject: string | null;
      invoiceEmailBody: string | null;
    }>;
  }, []);

  async function refreshIssuedInvoices() {
    await loadIssuedInvoices();
  }

  async function handlePatchIssued(
    invoice: IssuedInvoice,
    options?: {
      invoiceNumber?: string;
      numberingStrategy?: InvoiceNumberingStrategy;
    },
  ) {
    setAlert(null);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: invoice.clientId,
        from: invoice.periodStart,
        to: invoice.periodEnd,
        invoiceNumber: options?.invoiceNumber ?? invoice.invoiceNumber,
        numberingStrategy: options?.numberingStrategy,
      }),
    });
    if (!res.ok) {
      await applyApiErrorAlert(res, { clientId: invoice.clientId });
      return;
    }
    await refreshIssuedInvoices();
  }

  async function handlePrepareEmail(invoice: IssuedInvoice) {
    setAlert(null);
    const [clientMail, workspaceTemplate, senderStatus] = await Promise.all([
      loadClientMail(invoice.clientId),
      loadWorkspaceTemplate(),
      fetchInvoiceSenderStatus(),
    ]);
    const to = clientMail.recipientEmail?.trim();
    if (!to) {
      setPlainAlert(t("invoices.recipientEmailRequired"));
      return;
    }

    const vars = invoiceEmailPlaceholderVars({
      greetingName: clientMail.emailGreetingName?.trim() || invoice.recipient,
      invoiceNumber: invoice.invoiceNumber,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      operatorName: senderStatus.invoiceSender.name,
      locale,
    });
    const { subjectTemplate, bodyTemplate } = resolveInvoiceEmailTemplates({
      clientSubject: clientMail.invoiceEmailSubject,
      clientBody: clientMail.invoiceEmailBody,
      workspaceSubject: workspaceTemplate.invoiceEmailSubject,
      workspaceBody: workspaceTemplate.invoiceEmailBody,
      defaultSubject: t(
        "clients.invoiceEmailSubjectDefault",
        invoiceEmailPlaceholderLiterals,
      ),
      defaultBody: t(
        "clients.invoiceEmailBodyDefault",
        invoiceEmailPlaceholderLiterals,
      ),
    });
    const subject = fillInvoiceEmailTemplate(subjectTemplate, vars);
    const body = fillInvoiceEmailTemplate(bodyTemplate, vars);
    await deliverPrepareEmail({
      mailtoHref: buildMailtoHref(to, subject, body),
      downloadPdf: () => handleDownloadIssued(invoice),
    });
  }

  async function handleMarkSent(invoice: IssuedInvoice) {
    setAlert(null);
    const res = await fetch(`/api/invoices/${invoice.id}/mark-sent`, {
      method: "POST",
    });
    if (!res.ok) {
      await applyApiErrorAlert(res, { clientId: invoice.clientId });
      return;
    }
    await refreshIssuedInvoices();
  }

  async function handleVoid(invoice: IssuedInvoice) {
    setAlert(null);
    const res = await fetch(`/api/invoices/${invoice.id}/mark-void`, {
      method: "POST",
    });
    if (!res.ok) {
      await applyApiErrorAlert(res, { clientId: invoice.clientId });
      return;
    }
    await refreshIssuedInvoices();
  }

  const closeSenderEditor = () => {
    setEditingSender(false);
    setSenderForm(emptyInvoiceSenderForm);
  };

  async function handleSaveSender(event: React.FormEvent) {
    event.preventDefault();
    setSavingSender(true);
    setAlert(null);

    try {
      const status = await saveInvoiceSender(senderForm);
      setInvoiceSenderConfigured(status.configured);
      setInvoiceSenderName(status.invoiceSender.name);
      closeSenderEditor();
      if (previewUrl) {
        await requestPreview({
          invoiceNumber:
            invoiceNumber && invoiceNumber !== suggestedInvoiceNumber
              ? invoiceNumber
              : undefined,
          invoicePrefix: invoicePrefix ?? undefined,
        });
      }
    } catch (err) {
      setPlainAlert(t("invoices.saveInvoiceSenderFailed"));
    } finally {
      setSavingSender(false);
    }
  }

  const issueDisabled =
    previewing ||
    issuing ||
    loading ||
    !clientId ||
    !previewUrl ||
    !invoiceSenderConfigured ||
    invoiceNumberExists ||
    (invoiceNumberEdited && !numberingStrategy);

  const isMobile = useIsMobile();
  const primaryButtonClass = mobilePrimaryButtonClass(isMobile);
  const secondaryButtonClass = mobileSecondaryButtonClass(isMobile);

  return (
    <PageMain>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className={pageTitleClass}>{t("invoices.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openSenderEditor()}
            disabled={loading || loadingSender}
            className={secondaryButtonClass}
          >
            {t("invoices.invoiceSender")}
          </button>
          <button
            type="button"
            onClick={() => void handleIssue()}
            disabled={issueDisabled}
            className={primaryButtonClass}
          >
            {issuing ? t("invoices.issuing") : t("invoices.issueInvoice")}
          </button>
        </div>
      </div>

      <div className={`mb-8 flex flex-wrap gap-6 ${panelClass}`}>
        <label className={`flex min-w-[12rem] flex-1 flex-col gap-1 ${fieldLabelClass}`}>
          {t("invoices.client")}
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={loading || clients.length === 0}
            className={selectClass}
          >
            {clients.length === 0 ? (
              <option value="">{t("invoices.noClients")}</option>
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
          periodLabel={t("invoices.billingPeriod")}
          onChange={({ from: nextFrom, to: nextTo }) => {
            setFrom(nextFrom);
            setTo(nextTo);
          }}
        />
      </div>

      <div className={`mb-8 ${panelClass}`}>
        <label className={`flex items-center gap-2 ${fieldLabelClass}`}>
          <input
            type="checkbox"
            aria-label={t("invoices.usesSmallBusinessRule")}
            checked={usesSmallBusinessRule}
            onChange={(e) => handleUsesSmallBusinessRuleChange(e.target.checked)}
            disabled={previewing || issuing || !clientId}
            className="rounded border-input"
          />
          {t("invoices.usesSmallBusinessRule")}
        </label>
      </div>

      {alert ? (
        <InvoiceAlertBanner alert={alert} />
      ) : null}

      <InvoicePreviewPane
        previewing={previewing}
        previewUrl={previewUrl}
        previewAlert={previewAlert}
        previewIframeSrc={previewIframeSrc}
        buttonClass={secondaryButtonClass}
        onDownload={handleDownloadPreview}
        onFullscreen={() => setPreviewFullscreenOpen(true)}
        onRetry={() => void handleRetryPreview()}
      />

      {invoiceNumberExists ? (
        <p className="mb-4 rounded-md border border-accent-border bg-accent-muted px-4 py-3 text-sm text-accent">
          {t("invoices.invoiceNumberExists")}
        </p>
      ) : null}

      <fieldset className={`mb-8 space-y-3 ${panelClass}`}>
        <legend className={`px-1 ${fieldLabelClass}`}>
          {t("invoices.invoiceNumberSettingsTitle")}
        </legend>
        <p className={pageSubtitleClass}>{t("invoices.invoiceNumberSettingsHelpLine1")}</p>
        <p className={pageSubtitleClass}>{t("invoices.invoiceNumberSettingsHelpLine2")}</p>

        <label className={`flex items-center gap-2 ${fieldLabelClass}`}>
          <input
            type="checkbox"
            aria-label={t("invoices.invoiceNumberSeqBeforeYear")}
            checked={invoiceNumberSeqBeforeYear}
            onChange={(e) =>
              handleInvoiceNumberSeqBeforeYearChange(e.target.checked)
            }
            disabled={previewing || issuing || !clientId}
            className="rounded border-input"
          />
          {t("invoices.invoiceNumberSeqBeforeYear")}
        </label>

        <label className={`flex items-center gap-2 ${fieldLabelClass}`}>
          <input
            type="checkbox"
            aria-label={t("invoices.usePrefix")}
            checked={usePrefix}
            onChange={(e) => handleUsePrefixChange(e.target.checked)}
            disabled={previewing || issuing || !clientId}
            className="rounded border-input"
          />
          {t("invoices.usePrefix")}
        </label>

        <label className={`flex max-w-xs flex-col gap-1 ${fieldLabelClass}`}>
          {t("invoices.invoicePrefix")}
          <input
            type="text"
            aria-label={t("invoices.invoicePrefix")}
            value={invoicePrefix ?? ""}
            onChange={(e) => handleInvoicePrefixChange(e.target.value)}
            disabled={!invoiceNumber || previewing || issuing}
            placeholder={t("invoices.invoiceNumberAfterPreview")}
            className={`${inputClass} font-medium uppercase`}
          />
        </label>

        <label className={`flex max-w-xs flex-col gap-1 ${fieldLabelClass}`}>
          {t("invoices.invoiceNumber")}
          <input
            type="text"
            value={invoiceNumber ?? ""}
            onChange={(e) => handleInvoiceNumberChange(e.target.value)}
            disabled={!invoiceNumber || previewing || issuing}
            placeholder={t("invoices.invoiceNumberAfterPreview")}
            className={`${inputClass} font-medium`}
          />
        </label>

        {invoiceNumberEdited && numberingPreview ? (
          <fieldset className="rounded-md border border-accent-border bg-accent-muted px-4 py-3">
            <legend className={`px-1 ${fieldLabelClass}`}>
              {usePrefix
                ? t("invoices.futureInvoicesForClient", {
                    year: invoiceYearFromPeriodEnd(to),
                  })
                : t("invoices.futurePlainInvoices", {
                    year: invoiceYearFromPeriodEnd(to),
                  })}
            </legend>
            <div className={`mt-2 space-y-2 ${fieldLabelClass}`}>
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
                  {t("invoices.continueSuggestedSequence")}
                  <span className="mt-0.5 block text-muted">
                    {t("invoices.nextNumber", {
                      number: numberingPreview.nextIfIssued.sequential,
                    })}
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
                  {t("invoices.continueFromThisNumber")}
                  <span className="mt-0.5 block text-muted">
                    {t("invoices.nextNumber", {
                      number: numberingPreview.nextIfIssued.fromLast,
                    })}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        ) : null}
      </fieldset>

      {previewUrl && previewFullscreenOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("invoices.fullscreenPreview")}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          <InvoicePdfToolbar
            className="flex items-center justify-end gap-2 border-b border-divider px-4 py-3"
            buttonClass={secondaryButtonClass}
            downloadAriaLabel={t("invoices.downloadPreviewPdf")}
            closeAriaLabel={t("invoices.closeFullscreenPreview")}
            onDownload={handleDownloadPreview}
            onClose={() => setPreviewFullscreenOpen(false)}
          />
          <iframe
            title={t("invoices.fullscreenPreview")}
            src={previewIframeSrc(previewUrl)}
            className="min-h-0 w-full flex-1 border-0"
          />
        </div>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-medium text-content">{t("invoices.issuedInvoices")}</h2>
          <div
            className={`flex gap-3 ${
              isMobile
                ? "w-full flex-col items-stretch"
                : "flex-wrap items-end"
            }`}
          >
            <label
              className={`flex flex-col gap-1 ${fieldLabelClass} ${
                isMobile ? "min-w-0 flex-1" : "min-w-[10rem]"
              }`}
            >
              {t("invoices.exportClient")}
              <select
                value={exportClientId}
                onChange={(e) => setExportClientId(e.target.value)}
                disabled={loading || clients.length === 0}
                className={`${selectClass}${isMobile ? " min-h-11 w-full" : ""}`}
              >
                <option value="">{t("invoices.allClients")}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
              {t("invoices.exportYear")}
              <input
                type="number"
                min={2000}
                max={2100}
                placeholder={t("invoices.allYears")}
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
                className={`${inputClass}${isMobile ? " min-h-11 w-full" : " w-28"}`}
              />
            </label>
          </div>
        </div>
        <div className="mb-4">
          <button
            type="button"
            onClick={() => void handleExportOutgoing()}
            disabled={exporting || loading}
            className="text-sm text-muted underline hover:text-content disabled:opacity-50"
          >
            {exporting ? t("invoices.exporting") : t("invoices.exportOutgoing")}
          </button>
        </div>
        {issuedInvoices.length === 0 ? (
          <p className={`${emptyStateClass} py-6`}>
            {t("invoices.noIssuedInvoices")}
          </p>
        ) : (
          <IssuedInvoicesList
            invoices={issuedInvoices}
            downloadingId={downloadingId}
            selectedId={selectedInvoiceId}
            onSelect={setSelectedInvoiceId}
            onDownload={(invoice) => void handleDownloadIssued(invoice)}
            onRefreshLines={(invoice) => handlePatchIssued(invoice)}
            onSaveNumber={(invoice, invoiceNumber, strategy) =>
              handlePatchIssued(invoice, {
                invoiceNumber,
                numberingStrategy: strategy,
              })
            }
            onPrepareEmail={(invoice) => handlePrepareEmail(invoice)}
            onMarkSent={(invoice) => handleMarkSent(invoice)}
            onVoid={(invoice) => handleVoid(invoice)}
            loadClientMail={loadClientMail}
            loadWorkspaceTemplate={loadWorkspaceTemplate}
            operatorName={invoiceSenderName}
            formatBillingPeriod={formatBillingPeriod}
            formatAmount={formatCurrency}
            pdfUrl={(id) => `/api/invoices/${id}/pdf`}
          />
        )}
      </section>

      {editingSender && (
        <ResponsiveOverlay ariaLabel={t("invoices.senderTitle")}>
          <form onSubmit={handleSaveSender} className="w-full">
            <h2 className="text-lg font-semibold">{t("invoices.senderTitle")}</h2>
            <p className={`mt-1 ${metaTextClass}`}>
              {invoiceSenderConfigured
                ? t("invoices.senderConfiguredHint")
                : t("invoices.senderMissingHint")}
            </p>

            {loadingSender ? (
              <p className={`mt-4 ${metaTextClass}`}>{t("invoices.loading")}</p>
            ) : (
              <div className="mt-4 grid gap-3">
                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  {t("invoices.senderName")}
                  <input
                    required
                    value={senderForm.name}
                    onChange={(e) =>
                      setSenderForm((current) => ({
                        ...current,
                        name: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  {t("invoices.senderStreet")}
                  <input
                    value={senderForm.street}
                    onChange={(e) =>
                      setSenderForm((current) => ({
                        ...current,
                        street: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  {t("invoices.senderCity")}
                  <input
                    value={senderForm.city}
                    onChange={(e) =>
                      setSenderForm((current) => ({
                        ...current,
                        city: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  {t("invoices.senderTaxNumber")}
                  <input
                    value={senderForm.taxNumber}
                    onChange={(e) =>
                      setSenderForm((current) => ({
                        ...current,
                        taxNumber: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  {t("invoices.senderEmail")}
                  <input
                    required
                    type="email"
                    value={senderForm.email}
                    onChange={(e) =>
                      setSenderForm((current) => ({
                        ...current,
                        email: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  {t("invoices.senderPhone")}
                  <input
                    value={senderForm.phone}
                    onChange={(e) =>
                      setSenderForm((current) => ({
                        ...current,
                        phone: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <fieldset className="grid gap-3 rounded-md border border-divider p-3">
                  <legend className={`px-1 ${fieldLabelClass}`}>{t("invoices.bankDetails")}</legend>
                  <label className={`grid gap-1 ${fieldLabelClass}`}>
                    {t("invoices.senderBankName")}
                    <input
                      value={senderForm.bankName}
                      onChange={(e) =>
                        setSenderForm((current) => ({
                          ...current,
                          bankName: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={`grid gap-1 ${fieldLabelClass}`}>
                    {t("invoices.senderIban")}
                    <input
                      value={senderForm.iban}
                      onChange={(e) =>
                        setSenderForm((current) => ({
                          ...current,
                          iban: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={`grid gap-1 ${fieldLabelClass}`}>
                    {t("invoices.senderBic")}
                    <input
                      value={senderForm.bic}
                      onChange={(e) =>
                        setSenderForm((current) => ({
                          ...current,
                          bic: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                </fieldset>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeSenderEditor}
                className={secondaryButtonClass}
              >
                {t("invoices.cancel")}
              </button>
              <button
                type="submit"
                disabled={savingSender || loadingSender}
                className={primaryButtonClass}
              >
                {savingSender ? t("invoices.saving") : t("invoices.save")}
              </button>
            </div>
          </form>
        </ResponsiveOverlay>
      )}
    </PageMain>
  );
}
