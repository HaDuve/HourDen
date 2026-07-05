import { formatDurationHMM } from "@hourden/domain";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DateRangeFilter } from "./DateRangeFilter.js";
import { currentMonthRange } from "./date-range.js";
import { PageMain } from "./layout/PageMain.js";
import {
  cardClass,
  emptyStateClass,
  errorBannerClass,
  metaTextClass,
  numericMetaValueClass,
  numericValueClass,
  pageTitleClass,
  panelClass,
} from "./layout/ui-classes.js";
import { useLocaleFormat } from "./locale/use-locale-format.js";

type DashboardNamedTotal = {
  name: string;
  durationMinutes: number;
};

type DashboardDailyBucket = {
  date: string;
  durationMinutes: number;
};

type DashboardResponse = {
  from: string;
  to: string;
  totalDurationMinutes: number;
  totalBillableAmount: number;
  topProject: DashboardNamedTotal | null;
  topClient: DashboardNamedTotal | null;
  dailyBuckets: DashboardDailyBucket[];
};

async function fetchDashboard(from: string, to: string): Promise<DashboardResponse> {
  const res = await fetch(
    `/api/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load dashboard (${res.status})`);
  }
  return res.json() as Promise<DashboardResponse>;
}

function formatChartDuration(minutes: number): string {
  return formatDurationHMM(minutes);
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { formatCurrency, formatIsoDate } = useLocaleFormat();
  const chartLabelId = useId();
  const initialRange = currentMonthRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [summary, setSummary] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (rangeFrom: string, rangeTo: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboard(rangeFrom, rangeTo);
      setSummary(data);
    } catch {
      setError(t("dashboard.loadFailed"));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDashboard(from, to);
  }, [from, to, loadDashboard]);

  const chartData =
    summary?.dailyBuckets.map((bucket) => ({
      date: bucket.date,
      label: formatIsoDate(bucket.date),
      durationMinutes: bucket.durationMinutes,
    })) ?? [];

  return (
    <PageMain>
      <h1 className={`mb-8 ${pageTitleClass}`}>{t("dashboard.title")}</h1>

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
        <p className={`mb-4 ${errorBannerClass}`}>{error}</p>
      ) : null}

      {loading ? (
        <p className={metaTextClass}>{t("dashboard.loading")}</p>
      ) : !summary || summary.totalDurationMinutes === 0 ? (
        <p className={`${emptyStateClass} py-6`}>{t("dashboard.empty")}</p>
      ) : (
        <div className="space-y-8">
          <section aria-label={t("dashboard.kpiSection")}>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`${cardClass} p-4`}>
                <dt className="text-sm text-muted">{t("dashboard.totalTime")}</dt>
                <dd className={`mt-1 text-xl font-semibold ${numericValueClass}`}>
                  {formatDurationHMM(summary.totalDurationMinutes)}
                </dd>
              </div>
              <div className={`${cardClass} p-4`}>
                <dt className="text-sm text-muted">{t("dashboard.totalBillable")}</dt>
                <dd className={`mt-1 text-xl font-semibold ${numericValueClass}`}>
                  {formatCurrency(summary.totalBillableAmount)}
                </dd>
              </div>
              <div className={`${cardClass} p-4`}>
                <dt className="text-sm text-muted">{t("dashboard.topProject")}</dt>
                <dd className="mt-1 text-xl font-semibold text-content">
                  {summary.topProject?.name ?? t("dashboard.none")}
                </dd>
                {summary.topProject ? (
                  <dd className={`mt-1 text-sm ${numericMetaValueClass}`}>
                    {formatDurationHMM(summary.topProject.durationMinutes)}
                  </dd>
                ) : null}
              </div>
              <div className={`${cardClass} p-4`}>
                <dt className="text-sm text-muted">{t("dashboard.topClient")}</dt>
                <dd className="mt-1 text-xl font-semibold text-content">
                  {summary.topClient?.name ?? t("dashboard.none")}
                </dd>
                {summary.topClient ? (
                  <dd className={`mt-1 text-sm ${numericMetaValueClass}`}>
                    {formatDurationHMM(summary.topClient.durationMinutes)}
                  </dd>
                ) : null}
              </div>
            </dl>
          </section>

          <section aria-labelledby={chartLabelId} className={`${panelClass}`}>
            <h2 id={chartLabelId} className="mb-4 text-lg font-medium text-content">
              {t("dashboard.dailyChartTitle")}
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-divider)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--color-divider)" }}
                    tickLine={{ stroke: "var(--color-divider)" }}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--color-divider)" }}
                    tickLine={{ stroke: "var(--color-divider)" }}
                    tickFormatter={formatChartDuration}
                    width={56}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-divider)",
                      borderRadius: "0.375rem",
                      color: "var(--color-content)",
                    }}
                    labelStyle={{ color: "var(--color-muted)" }}
                    formatter={(value) => [
                      formatChartDuration(Number(value)),
                      t("dashboard.duration"),
                    ]}
                  />
                  <Bar
                    dataKey="durationMinutes"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </PageMain>
  );
}
