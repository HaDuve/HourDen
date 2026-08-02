import { useState } from "react";
import {
  fieldLabelClass,
  inputClass,
  listPanelClass,
  metaTextClass,
  primaryButtonClass,
  secondaryButtonClass,
  destructiveButtonClass,
} from "../../layout/ui-classes.js";
import { protoCopy } from "./copy.js";
import {
  EventBanner,
  FakePdfFrame,
  SharedSurfaces,
  StateDump,
  StatusPill,
  findInvoice,
} from "./SharedSurfaces.js";
import type { DemoInvoice, SentGatePrototypeModel } from "./types.js";

export const variantCName = "Detail panel + tabs";

type Tab = "pdf" | "edit" | "email";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type ListRow =
  | { kind: "year"; year: string }
  | { kind: "month"; key: string; label: string }
  | { kind: "invoice"; inv: DemoInvoice };

function buildGroupedRows(invoices: DemoInvoice[]): ListRow[] {
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
        label: MONTH_LABELS[monthIdx] ?? monthKey,
      });
      lastMonthKey = monthKey;
    }
    rows.push({ kind: "invoice", inv });
  }
  return rows;
}

/**
 * Master–detail: pick a row → right panel with PDF / Edit / Email tabs.
 * Status gates which tabs are writable. Void is a dedicated replace path in the panel.
 * Overlays only for Did-you-send + Void confirm (Prepare is the Email tab).
 * Master list grouped with year + month separators (billing-period end).
 */
export function VariantC(model: SentGatePrototypeModel) {
  const visible = model.invoices.filter((i) => i.status !== "voided");
  const selected =
    (model.selectedId && findInvoice(model, model.selectedId)) || visible[0] || null;
  const [tab, setTab] = useState<Tab>("pdf");
  const rows = buildGroupedRows(visible);

  // Route prepare/edit/reader into the panel instead of overlays when possible
  const panelModel: SentGatePrototypeModel = {
    ...model,
    surface:
      model.surface.kind === "reader" ||
      model.surface.kind === "edit" ||
      model.surface.kind === "prepare"
        ? { kind: "none" }
        : model.surface,
  };

  return (
    <div className="space-y-4">
      <EventBanner model={model} />
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
                    model.onSelect(inv.id);
                    setTab("pdf");
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-content">{inv.invoiceNumber}</span>
                    <StatusPill status={inv.status} />
                  </span>
                  <span className={metaTextClass}>{inv.recipient}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <DetailPanel
            inv={selected}
            model={model}
            tab={tab}
            setTab={setTab}
          />
        ) : (
          <p className={metaTextClass}>Select an invoice.</p>
        )}
      </div>
      <SharedSurfaces model={panelModel} />
      <StateDump model={model} />
    </div>
  );
}

function DetailPanel({
  inv,
  model,
  tab,
  setTab,
}: {
  inv: DemoInvoice;
  model: SentGatePrototypeModel;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const mail = model.clientMail[inv.clientId];
  const issued = inv.status === "issued";
  const sent = inv.status === "sent";

  return (
    <div className="rounded-lg border border-divider bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-content">{inv.invoiceNumber}</h2>
          <p className={metaTextClass}>
            {inv.recipient} · {inv.periodLabel} · {inv.totalLabel}
          </p>
        </div>
        <StatusPill status={inv.status} />
      </div>

      <div className="mb-4 flex gap-1 border-b border-divider">
        {(
          [
            ["pdf", protoCopy.pdfTab],
            ["edit", protoCopy.editTab],
            ["email", protoCopy.emailTab],
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
            {key === "edit" && !issued ? " (locked)" : ""}
          </button>
        ))}
      </div>

      {tab === "pdf" ? (
        <div className="space-y-3">
          <FakePdfFrame invoice={inv} />
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => model.onDownload(inv.id)}
          >
            {protoCopy.download}
          </button>
        </div>
      ) : null}

      {tab === "edit" ? (
        issued ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              model.onPatchInvoice(inv.id, {
                invoiceNumber: String(fd.get("invoiceNumber") ?? inv.invoiceNumber),
              });
            }}
          >
            <p className={metaTextClass}>{protoCopy.editHint}</p>
            <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
              Invoice Number
              <input
                name="invoiceNumber"
                className={inputClass}
                defaultValue={inv.invoiceNumber}
                key={inv.invoiceNumber}
              />
            </label>
            <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
              Recipient / lines (stub)
              <textarea
                className={inputClass}
                rows={4}
                defaultValue={`${inv.recipient}\nGrouped lines…\n${inv.totalLabel}`}
              />
            </label>
            <button type="submit" className={primaryButtonClass}>
              {protoCopy.save}
            </button>
          </form>
        ) : (
          <p className={metaTextClass}>
            Frozen at Sent. Post-delivery correction uses Void & replace — not unlock.
          </p>
        )
      ) : null}

      {tab === "email" ? (
        <div className="space-y-3">
          {issued ? (
            <>
              <p className={metaTextClass}>{protoCopy.prepareConfirmBody}</p>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{protoCopy.recipientEmail}</dt>
                  <dd>{mail?.recipientEmail}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{protoCopy.greetingName}</dt>
                  <dd>{mail?.emailGreetingName}</dd>
                </div>
              </dl>
              <pre className="whitespace-pre-wrap rounded-md border border-divider p-3 text-xs text-muted">
                {mail?.invoiceEmailTemplateSubject}
                {"\n\n"}
                {mail?.invoiceEmailTemplateBody}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => model.onConfirmPrepare(inv.id)}
                >
                  {protoCopy.prepareOpenMail}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => model.onOpenClientMail(inv.clientId)}
                >
                  {protoCopy.clientMail}
                </button>
              </div>
            </>
          ) : sent ? (
            <div className="space-y-3">
              <p className={metaTextClass}>
                Already Sent. To correct after delivery, void and Issue a replacement.
              </p>
              <button
                type="button"
                className={destructiveButtonClass}
                onClick={() => model.onOpenVoid(inv.id)}
              >
                {protoCopy.replacePath}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
