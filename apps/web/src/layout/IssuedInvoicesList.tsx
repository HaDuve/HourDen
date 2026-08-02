import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Download from "lucide-react/icons/download";
import Maximize2 from "lucide-react/icons/maximize-2";
import {
  destructiveButtonClass,
  fieldLabelClass,
  inputClass,
  listPanelClass,
  metaTextClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui-classes.js";

const TOOLBAR_ICON_SIZE = 16;
const TOOLBAR_ICON_STROKE = 1.75;

export type IssuedInvoice = {
  id: string;
  clientId: string;
  recipient: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: "issued" | "sent" | string;
};

export type ClientMailSettings = {
  recipientEmail: string | null;
  emailGreetingName: string | null;
  invoiceEmailSubject: string | null;
  invoiceEmailBody: string | null;
};

export type WorkspaceMailTemplate = {
  invoiceEmailSubject: string | null;
  invoiceEmailBody: string | null;
};

type Tab = "pdf" | "edit" | "email";

type ListRow =
  | { kind: "year"; year: string }
  | { kind: "month"; key: string; label: string }
  | { kind: "invoice"; inv: IssuedInvoice };

type IssuedInvoicesListProps = {
  invoices: IssuedInvoice[];
  downloadingId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDownload: (invoice: IssuedInvoice) => void;
  onRefreshLines: (invoice: IssuedInvoice) => Promise<void>;
  onSaveNumber: (
    invoice: IssuedInvoice,
    invoiceNumber: string,
    numberingStrategy?: "sequential" | "from_last",
  ) => Promise<void>;
  onPrepareEmail: (invoice: IssuedInvoice) => Promise<void>;
  onMarkSent: (invoice: IssuedInvoice) => Promise<void>;
  onVoid: (invoice: IssuedInvoice) => Promise<void>;
  loadClientMail: (clientId: string) => Promise<ClientMailSettings>;
  loadWorkspaceTemplate: () => Promise<WorkspaceMailTemplate>;
  formatBillingPeriod: (start: string, end: string) => string;
  formatAmount: (amount: number) => string;
  pdfUrl: (invoiceId: string) => string;
};

function buildGroupedRows(
  invoices: IssuedInvoice[],
  monthLabel: (monthIndex: number) => string,
): ListRow[] {
  const sorted = [...invoices].sort((a, b) =>
    b.periodEnd.localeCompare(a.periodEnd),
  );
  const rows: ListRow[] = [];
  let lastYear = "";
  let lastMonthKey = "";

  for (const inv of sorted) {
    const year = inv.periodEnd.slice(0, 4);
    const monthIdx = Number(inv.periodEnd.slice(5, 7)) - 1;
    const monthKey = inv.periodEnd.slice(0, 7);
    if (year !== lastYear) {
      rows.push({ kind: "year", year });
      lastYear = year;
      lastMonthKey = "";
    }
    if (monthKey !== lastMonthKey) {
      rows.push({
        kind: "month",
        key: monthKey,
        label: monthLabel(monthIdx),
      });
      lastMonthKey = monthKey;
    }
    rows.push({ kind: "invoice", inv });
  }
  return rows;
}

export function IssuedInvoicesList({
  invoices,
  downloadingId,
  selectedId,
  onSelect,
  onDownload,
  onRefreshLines,
  onSaveNumber,
  onPrepareEmail,
  onMarkSent,
  onVoid,
  loadClientMail,
  loadWorkspaceTemplate,
  formatBillingPeriod,
  formatAmount,
  pdfUrl,
}: IssuedInvoicesListProps) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>("pdf");
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [didSendOpen, setDidSendOpen] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editNumber, setEditNumber] = useState("");
  const [numberingStrategy, setNumberingStrategy] = useState<
    "sequential" | "from_last" | ""
  >("");
  const [mail, setMail] = useState<ClientMailSettings | null>(null);
  const [workspaceTemplate, setWorkspaceTemplate] =
    useState<WorkspaceMailTemplate | null>(null);

  const selected =
    invoices.find((inv) => inv.id === selectedId) ?? invoices[0] ?? null;

  const rows = useMemo(
    () =>
      buildGroupedRows(invoices, (monthIndex) =>
        new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(
          new Date(Date.UTC(2020, monthIndex, 1)),
        ),
      ),
    [invoices, i18n.language],
  );

  useEffect(() => {
    if (!selected) return;
    setTab("pdf");
    setEditNumber(selected.invoiceNumber);
    setNumberingStrategy("");
    setDidSendOpen(false);
    setVoidConfirmOpen(false);
    setFullscreenOpen(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreenOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreenOpen]);

  useEffect(() => {
    if (!selected || tab !== "email") return;
    let cancelled = false;
    void (async () => {
      const [clientMail, workspace] = await Promise.all([
        loadClientMail(selected.clientId),
        loadWorkspaceTemplate(),
      ]);
      if (!cancelled) {
        setMail(clientMail);
        setWorkspaceTemplate(workspace);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.clientId, tab, loadClientMail, loadWorkspaceTemplate]);

  if (invoices.length === 0) {
    return null;
  }

  const issued = selected?.status === "issued";
  const sent = selected?.status === "sent";
  const subject =
    mail?.invoiceEmailSubject ||
    workspaceTemplate?.invoiceEmailSubject ||
    "";
  const body =
    mail?.invoiceEmailBody || workspaceTemplate?.invoiceEmailBody || "";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
      <ul className={listPanelClass}>
        {rows.map((row) => {
          if (row.kind === "year") {
            return (
              <li
                key={`year-${row.year}`}
                className="border-t border-divider bg-surface-hover px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted first:border-t-0"
              >
                {row.year}
              </li>
            );
          }
          if (row.kind === "month") {
            return (
              <li
                key={`month-${row.key}`}
                className="px-4 pb-1 pt-3 text-xs font-medium text-muted"
              >
                {row.label}
              </li>
            );
          }
          const { inv } = row;
          return (
            <li key={inv.id}>
              <button
                type="button"
                className={`flex w-full flex-col gap-1 px-4 py-2.5 text-left hover:bg-surface-hover ${
                  selected?.id === inv.id ? "bg-surface-hover" : ""
                }`}
                onClick={() => {
                  onSelect(inv.id);
                  setTab("pdf");
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-content">
                    {inv.invoiceNumber}
                  </span>
                  <StatusPill status={inv.status} />
                </span>
                <span className={metaTextClass}>{inv.recipient}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="rounded-lg border border-divider bg-surface p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-content">
                {selected.invoiceNumber}
              </h3>
              <p className={metaTextClass}>
                {selected.recipient} ·{" "}
                {formatBillingPeriod(selected.periodStart, selected.periodEnd)}{" "}
                · {formatAmount(selected.totalAmount)}
              </p>
            </div>
            <StatusPill status={selected.status} />
          </div>

          <div className="mb-4 flex gap-1 border-b border-divider">
            {(
              [
                ["pdf", t("invoices.pdfTab")],
                ["edit", t("invoices.editTab")],
                ["email", t("invoices.emailTab")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`px-3 py-2 text-sm ${
                  tab === key
                    ? "border-b-2 border-content font-medium text-content"
                    : "text-muted hover:text-content"
                }`}
                onClick={() => setTab(key)}
              >
                {label}
                {key === "edit" && !issued
                  ? ` (${t("invoices.editLocked")})`
                  : ""}
              </button>
            ))}
          </div>

          {tab === "pdf" ? (
            <div className="space-y-3">
              <iframe
                title={t("invoices.readerTitle", {
                  number: selected.invoiceNumber,
                })}
                src={`${pdfUrl(selected.id)}#toolbar=0`}
                className="h-[28rem] w-full rounded-md border border-divider"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
                  aria-label={t("invoices.fullscreenReader")}
                  onClick={() => setFullscreenOpen(true)}
                >
                  <Maximize2
                    size={TOOLBAR_ICON_SIZE}
                    strokeWidth={TOOLBAR_ICON_STROKE}
                    aria-hidden
                    className="shrink-0"
                  />
                  {t("invoices.fullscreen")}
                </button>
                <button
                  type="button"
                  className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
                  disabled={downloadingId === selected.id}
                  onClick={() => onDownload(selected)}
                >
                  <Download
                    size={TOOLBAR_ICON_SIZE}
                    strokeWidth={TOOLBAR_ICON_STROKE}
                    aria-hidden
                    className="shrink-0"
                  />
                  {downloadingId === selected.id
                    ? t("invoices.downloading")
                    : t("invoices.download")}
                </button>
              </div>
            </div>
          ) : null}

          {tab === "edit" ? (
            issued ? (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    setBusy(true);
                    try {
                      await onSaveNumber(
                        selected,
                        editNumber.trim(),
                        numberingStrategy || undefined,
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                <p className={metaTextClass}>{t("invoices.editHint")}</p>
                <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
                  {t("invoices.invoiceNumber")}
                  <input
                    className={inputClass}
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                  />
                </label>
                {editNumber.trim() !== selected.invoiceNumber ? (
                  <fieldset className="space-y-2">
                    <legend className={fieldLabelClass}>
                      {t("invoices.chooseNumberingStrategy")}
                    </legend>
                    <label className="flex items-center gap-2 text-sm text-content">
                      <input
                        type="radio"
                        name="numberingStrategy"
                        checked={numberingStrategy === "sequential"}
                        onChange={() => setNumberingStrategy("sequential")}
                      />
                      {t("invoices.continueSuggestedSequence")}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-content">
                      <input
                        type="radio"
                        name="numberingStrategy"
                        checked={numberingStrategy === "from_last"}
                        onChange={() => setNumberingStrategy("from_last")}
                      />
                      {t("invoices.continueFromThisNumber")}
                    </label>
                  </fieldset>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className={primaryButtonClass}
                    disabled={
                      busy ||
                      (editNumber.trim() !== selected.invoiceNumber &&
                        !numberingStrategy)
                    }
                  >
                    {busy ? t("invoices.saving") : t("invoices.save")}
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          await onRefreshLines(selected);
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    {t("invoices.refreshLines")}
                  </button>
                </div>
              </form>
            ) : (
              <p className={metaTextClass}>{t("invoices.editFrozenHint")}</p>
            )
          ) : null}

          {tab === "email" ? (
            <div className="space-y-3">
              {issued ? (
                <>
                  <p className={metaTextClass}>
                    {t("invoices.prepareEmailHint")}
                  </p>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("invoices.recipientEmail")}
                      </dt>
                      <dd>{mail?.recipientEmail || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("invoices.emailGreetingName")}
                      </dt>
                      <dd>{mail?.emailGreetingName || "—"}</dd>
                    </div>
                  </dl>
                  <pre className="whitespace-pre-wrap rounded-md border border-divider p-3 text-xs text-muted">
                    {subject || t("invoices.noEmailTemplate")}
                    {"\n\n"}
                    {body}
                  </pre>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={busy || !mail?.recipientEmail}
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          await onPrepareEmail(selected);
                          setDidSendOpen(true);
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    {t("invoices.prepareEmail")}
                  </button>
                  {!mail?.recipientEmail ? (
                    <p className={metaTextClass}>
                      {t("invoices.recipientEmailRequired")}
                    </p>
                  ) : null}
                </>
              ) : sent ? (
                <div className="space-y-3">
                  <p className={metaTextClass}>{t("invoices.voidHint")}</p>
                  <button
                    type="button"
                    className={destructiveButtonClass}
                    onClick={() => setVoidConfirmOpen(true)}
                  >
                    {t("invoices.voidAndReplace")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {didSendOpen ? (
            <div className="mt-4 rounded-md border border-divider bg-surface-hover p-4">
              <p className="font-medium text-content">
                {t("invoices.didYouSendTitle")}
              </p>
              <p className={`mt-1 ${metaTextClass}`}>
                {t("invoices.didYouSendBody")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await onMarkSent(selected);
                        setDidSendOpen(false);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {t("invoices.didYouSendYes")}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={busy}
                  onClick={() => setDidSendOpen(false)}
                >
                  {t("invoices.didYouSendNo")}
                </button>
              </div>
            </div>
          ) : null}

          {voidConfirmOpen ? (
            <div className="mt-4 rounded-md border border-destructive-border bg-destructive-muted p-4">
              <p className="font-medium text-danger">
                {t("invoices.voidConfirmTitle")}
              </p>
              <p className={`mt-1 ${metaTextClass}`}>
                {t("invoices.voidConfirmBody")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={destructiveButtonClass}
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await onVoid(selected);
                        setVoidConfirmOpen(false);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {t("invoices.voidConfirm")}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={busy}
                  onClick={() => setVoidConfirmOpen(false)}
                >
                  {t("invoices.cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className={metaTextClass}>{t("invoices.selectInvoice")}</p>
      )}
      {selected && fullscreenOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("invoices.fullscreenReader")}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          <div className="flex items-center justify-end gap-2 border-b border-divider px-4 py-3">
            <button
              type="button"
              className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
              disabled={downloadingId === selected.id}
              onClick={() => onDownload(selected)}
            >
              <Download
                size={TOOLBAR_ICON_SIZE}
                strokeWidth={TOOLBAR_ICON_STROKE}
                aria-hidden
                className="shrink-0"
              />
              {downloadingId === selected.id
                ? t("invoices.downloading")
                : t("invoices.download")}
            </button>
            <button
              type="button"
              className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
              aria-label={t("invoices.closeFullscreenReader")}
              onClick={() => setFullscreenOpen(false)}
            >
              {t("nav.close")}
            </button>
          </div>
          <iframe
            title={t("invoices.fullscreenReader")}
            src={`${pdfUrl(selected.id)}#toolbar=0`}
            className="min-h-0 w-full flex-1 border-0"
          />
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const label =
    status === "issued"
      ? t("invoices.statusIssued")
      : status === "sent"
        ? t("invoices.statusSent")
        : status;
  return (
    <span className="rounded-md border border-divider px-2 py-0.5 text-xs font-medium text-muted">
      {label}
    </span>
  );
}
