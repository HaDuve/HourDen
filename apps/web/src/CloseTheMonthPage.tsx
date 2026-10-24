import type { MonthReadinessSummary } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { DateRangeFilter } from "./DateRangeFilter.js";
import {
  billingPeriodFromSearchParams,
  currentMonthRange,
} from "./date-range.js";
import { PageMain } from "./layout/PageMain.js";
import { mobilePrimaryButtonClass } from "./layout/tap-targets.js";
import {
  bodyTextClass,
  emptyStateClass,
  errorBannerClass,
  inputClass,
  listPanelClass,
  metaTextClass,
  numericValueClass,
  pageSubtitleClass,
  pageTitleClass,
  primaryButtonClass,
} from "./layout/ui-classes.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useLocaleFormat } from "./locale/use-locale-format.js";

async function fetchMonthReadiness(
  from: string,
  to: string,
): Promise<MonthReadinessSummary> {
  const res = await fetch(
    `/api/invoices/month-readiness?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load month readiness (${res.status})`);
  }
  return res.json() as Promise<MonthReadinessSummary>;
}

async function patchEntryDescription(
  entryId: string,
  description: string,
): Promise<void> {
  const res = await fetch(`/api/time-entries/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update entry (${res.status})`);
  }
}

function invoicePreviewHref(clientId: string, from: string, to: string): string {
  return `/invoices?clientId=${encodeURIComponent(clientId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

function IncompleteDescriptionFix({
  entryId,
  startedAt,
  onSaved,
}: {
  entryId: string;
  startedAt: string;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await patchEntryDescription(entryId, trimmed);
      onSaved();
    } catch {
      setError(t("closeTheMonth.saveDescriptionFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-muted">
        <span>
          {t("closeTheMonth.missingDescription")} ·{" "}
          {formatDate(new Date(startedAt))}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
          className={inputClass}
          aria-label={t("closeTheMonth.descriptionForEntry")}
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !value.trim()}
        className={primaryButtonClass}
      >
        {saving ? t("common.saving") : t("common.save")}
      </button>
      {error ? <p className={`w-full ${errorBannerClass}`}>{error}</p> : null}
    </div>
  );
}

export default function CloseTheMonthPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { formatCurrency } = useLocaleFormat();
  const isMobile = useIsMobile();
  const previewButtonClass = mobilePrimaryButtonClass(isMobile);

  const initialRange =
    billingPeriodFromSearchParams(searchParams) ?? currentMonthRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [summary, setSummary] = useState<MonthReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchMonthReadiness(from, to));
    } catch {
      setSummary(null);
      setError(t("closeTheMonth.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [from, to, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageMain>
      <header className="mb-8">
        <h1 className={pageTitleClass}>{t("closeTheMonth.title")}</h1>
        <p className={pageSubtitleClass}>{t("closeTheMonth.subtitle")}</p>
      </header>

      <div className="mb-8">
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

      {error ? <p className={`mb-6 ${errorBannerClass}`}>{error}</p> : null}

      {!summary?.invoiceSenderConfigured ? (
        <p className={`mb-6 ${bodyTextClass}`}>
          {t("closeTheMonth.missingSender")}{" "}
          <Link
            to="/invoices?editSender=1"
            className="text-content underline underline-offset-2"
          >
            {t("closeTheMonth.fixInvoiceSender")}
          </Link>
        </p>
      ) : null}

      {loading ? (
        <p className={metaTextClass}>{t("closeTheMonth.loading")}</p>
      ) : null}

      {!loading && summary?.monthClosed ? (
        <p className={emptyStateClass} role="status">
          {t("closeTheMonth.monthClosed")}
        </p>
      ) : null}

      {!loading &&
      summary &&
      !summary.monthClosed &&
      summary.clients.length === 0 ? (
        <p className={emptyStateClass}>{t("closeTheMonth.empty")}</p>
      ) : null}

      {!loading && summary && summary.clients.length > 0 ? (
        <ul className={listPanelClass}>
          {summary.clients.map((client) => {
            const readiness = t("closeTheMonth.readinessCount", {
              complete: client.billableCompleteCount,
              total: client.stoppedEntryCount,
            });
            const invoiceLabel =
              client.invoiceStatus === "none"
                ? t("closeTheMonth.noInvoice")
                : client.invoiceStatus === "issued"
                  ? t("closeTheMonth.invoiceIssued")
                  : t("closeTheMonth.invoiceSent");

            return (
              <li key={client.clientId} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-content">{client.clientName}</p>
                    <p className={metaTextClass}>
                      {readiness}
                      <span aria-hidden="true"> · </span>
                      {invoiceLabel}
                    </p>
                  </div>
                  <p className={`${numericValueClass} text-sm`}>
                    {formatCurrency(client.unbilledAmount)}
                  </p>
                </div>

                {client.missingRecipient ? (
                  <p className={`mt-2 ${bodyTextClass}`}>
                    {t("closeTheMonth.missingRecipient")}{" "}
                    <Link
                      to={`/clients?edit=${encodeURIComponent(client.clientId)}`}
                      className="text-content underline underline-offset-2"
                    >
                      {t("closeTheMonth.fixRecipient")}
                    </Link>
                  </p>
                ) : null}

                {client.incompleteEntries.map((entry) => (
                  <IncompleteDescriptionFix
                    key={entry.id}
                    entryId={entry.id}
                    startedAt={entry.startedAt}
                    onSaved={() => void load()}
                  />
                ))}

                {client.invoiceStatus === "none" &&
                client.billableCompleteCount > 0 &&
                !client.missingRecipient &&
                client.incompleteEntries.length === 0 ? (
                  <div className="mt-3">
                    <Link
                      to={invoicePreviewHref(client.clientId, from, to)}
                      className={`${previewButtonClass} inline-flex no-underline`}
                    >
                      {t("closeTheMonth.previewInvoice")}
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </PageMain>
  );
}
