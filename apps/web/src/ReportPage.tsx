import type { ClientReport } from "@hourden/domain";
import { formatDurationHMM } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DateRangeFilter } from "./DateRangeFilter.js";
import { currentMonthRange } from "./date-range.js";
import { PageMain } from "./layout/PageMain.js";
import { mobilePrimaryButtonClass } from "./layout/tap-targets.js";
import {
  cardClass,
  emptyStateClass,
  errorBannerClass,
  metaTextClass,
  pageTitleClass,
  panelClass,
} from "./layout/ui-classes.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useLocaleFormat } from "./locale/use-locale-format.js";

type ReportResponse = {
  from: string;
  to: string;
  clients: ClientReport[];
};

async function fetchReport(from: string, to: string): Promise<ReportResponse> {
  const res = await fetch(
    `/api/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load report (${res.status})`);
  }
  return res.json() as Promise<ReportResponse>;
}

export default function ReportPage() {
  const { t } = useTranslation();
  const { formatCurrency, formatIsoDate } = useLocaleFormat();
  const initialRange = currentMonthRange();
  const isMobile = useIsMobile();
  const primaryButtonClass = mobilePrimaryButtonClass(isMobile);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [clients, setClients] = useState<ClientReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async (rangeFrom: string, rangeTo: string) => {
    setLoading(true);
    setError(null);
    try {
      const report = await fetchReport(rangeFrom, rangeTo);
      setClients(report.clients);
    } catch (err) {
      setError(t("report.loadFailed"));
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadReport(from, to);
  }, [from, to, loadReport]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to export report (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `report_${from}_${to}.csv`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(t("report.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageMain>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className={pageTitleClass}>{t("report.title")}</h1>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || loading}
          className={primaryButtonClass}
        >
          {exporting ? t("report.exporting") : t("report.exportCsv")}
        </button>
      </div>

      <div className={`mb-8 ${panelClass}`}>
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
        <p className={`mb-4 ${errorBannerClass}`}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={metaTextClass}>{t("report.loading")}</p>
      ) : clients.length === 0 ? (
        <p className={`${emptyStateClass} py-6`}>
          {t("report.empty")}
        </p>
      ) : (
        <div className="space-y-8">
          {clients.map((client) => (
            <section key={client.clientName}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-divider pb-2">
                <h2 className="text-lg font-medium text-content">
                  {client.clientName || t("report.noClient")}
                </h2>
                <p className={metaTextClass}>
                  {formatDurationHMM(client.totalDurationMinutes)} ·{" "}
                  {formatCurrency(client.totalAmount)}
                </p>
              </div>
              <ul className="space-y-2">
                {client.lines.map((line) =>
                  isMobile ? (
                    <li
                      key={`${line.date}-${line.description}`}
                      data-testid="report-line-card"
                      className={`${cardClass} p-3`}
                    >
                      <dl className="grid gap-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">{t("report.date")}</dt>
                          <dd className="text-content">
                            {formatIsoDate(line.date)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">{t("report.description")}</dt>
                          <dd className="text-right text-content">
                            {line.description}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">{t("report.duration")}</dt>
                          <dd className="text-muted">
                            {formatDurationHMM(line.durationMinutes)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">{t("report.amount")}</dt>
                          <dd className="text-muted">
                            {formatCurrency(line.amount)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ) : (
                    <li
                      key={`${line.date}-${line.description}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="text-content">
                        <span className="text-muted">
                          {formatIsoDate(line.date)}
                        </span>{" "}
                        {line.description}
                      </span>
                      <span className="text-muted">
                        {formatDurationHMM(line.durationMinutes)} ·{" "}
                        {formatCurrency(line.amount)}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageMain>
  );
}
