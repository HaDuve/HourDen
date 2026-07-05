import { formatDurationHMM } from "@hourden/domain";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  listPanelClass,
} from "./layout/ui-classes.js";
import { useLocaleFormat } from "./locale/use-locale-format.js";

type DashboardNamedTotal = {
  name: string | null;
  durationMinutes: number;
};

type DashboardDailyBucket = {
  date: string;
  durationMinutes: number;
};

type DashboardTopActivity = {
  description: string;
  projectName: string | null;
  clientName: string | null;
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
  clientBuckets: DashboardNamedTotal[];
  topActivities: DashboardTopActivity[];
};

const CLIENT_CHART_COLORS = [
  "var(--color-chart-series-1)",
  "var(--color-chart-series-2)",
  "var(--color-chart-series-3)",
  "var(--color-chart-series-4)",
  "var(--color-chart-series-5)",
  "var(--color-chart-series-6)",
];

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

function formatClientBucketLabel(
  name: string | null,
  t: (key: string) => string,
): string {
  return name ?? t("dashboard.unassignedClient");
}

function formatActivityContext(
  activity: Pick<DashboardTopActivity, "projectName" | "clientName">,
): string | null {
  const parts = [activity.projectName, activity.clientName].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { formatCurrency, formatIsoDate } = useLocaleFormat();
  const chartLabelId = useId();
  const clientChartLabelId = useId();
  const topActivitiesLabelId = useId();
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

  const clientChartData = summary?.clientBuckets ?? [];
  const clientBucketTotalMinutes = clientChartData.reduce(
    (total, bucket) => total + bucket.durationMinutes,
    0,
  );

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

          <section className="grid gap-8 lg:grid-cols-2">
            <div className={panelClass}>
              <h2
                id={clientChartLabelId}
                className="mb-4 text-lg font-medium text-content"
              >
                {t("dashboard.clientChartTitle")}
              </h2>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative mx-auto h-56 w-full max-w-xs sm:mx-0 sm:flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={clientChartData}
                        dataKey="durationMinutes"
                        nameKey="name"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                        stroke="var(--color-surface)"
                      >
                        {clientChartData.map((bucket, index) => (
                          <Cell
                            key={bucket.name ?? `unassigned-${index}`}
                            fill={CLIENT_CHART_COLORS[index % CLIENT_CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface)",
                          border: "1px solid var(--color-divider)",
                          borderRadius: "0.375rem",
                          color: "var(--color-content)",
                        }}
                        labelStyle={{ color: "var(--color-muted)" }}
                        formatter={(value, _name, item) => {
                          const minutes = Number(value);
                          const percentage =
                            clientBucketTotalMinutes > 0
                              ? Math.round((minutes / clientBucketTotalMinutes) * 100)
                              : 0;
                          const bucketName =
                            item.payload && "name" in item.payload
                              ? (item.payload.name as string | null)
                              : null;

                          return [
                            `${formatChartDuration(minutes)} (${percentage}%)`,
                            formatClientBucketLabel(bucketName, t),
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    aria-label={t("dashboard.clientChartTotal")}
                    className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <span className="text-xs text-muted">{t("dashboard.clientChartTotal")}</span>
                    <span className={`text-lg font-semibold ${numericValueClass}`}>
                      {formatDurationHMM(summary.totalDurationMinutes)}
                    </span>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2 text-sm text-content">
                  {clientChartData.map((bucket, index) => {
                    const percentage =
                      clientBucketTotalMinutes > 0
                        ? Math.round((bucket.durationMinutes / clientBucketTotalMinutes) * 100)
                        : 0;

                    return (
                      <li
                        key={bucket.name ?? `unassigned-${index}`}
                        className="flex items-center gap-2"
                      >
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              CLIENT_CHART_COLORS[index % CLIENT_CHART_COLORS.length],
                          }}
                        />
                        <span>
                          {formatClientBucketLabel(bucket.name, t)} ({percentage}%)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className={panelClass}>
              <h2
                id={topActivitiesLabelId}
                className="mb-4 text-lg font-medium text-content"
              >
                {t("dashboard.topActivitiesTitle")}
              </h2>
              <ul
                aria-labelledby={topActivitiesLabelId}
                className={listPanelClass}
              >
                {(summary?.topActivities ?? []).map((activity) => {
                  const activityContext = formatActivityContext(activity);

                  return (
                  <li
                    key={activity.description}
                    className="flex items-start justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-content">{activity.description}</p>
                      {activityContext ? (
                        <p className="text-sm text-muted">{activityContext}</p>
                      ) : null}
                    </div>
                    <span className={`shrink-0 ${numericMetaValueClass}`}>
                      {formatDurationHMM(activity.durationMinutes)}
                    </span>
                  </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      )}
    </PageMain>
  );
}
