import type { ReactNode } from "react";
import { ResponsiveOverlay } from "../../layout/ResponsiveOverlay.js";
import {
  destructiveButtonClass,
  fieldLabelClass,
  infoPanelClass,
  inputClass,
  metaTextClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../layout/ui-classes.js";
import { protoCopy } from "./copy.js";
import type { DemoInvoice, SentGatePrototypeModel } from "./types.js";

export function findInvoice(
  model: SentGatePrototypeModel,
  id: string,
): DemoInvoice | undefined {
  return model.invoices.find((i) => i.id === id);
}

export function StatusPill({ status }: { status: DemoInvoice["status"] }) {
  const label =
    status === "issued"
      ? protoCopy.issued
      : status === "sent"
        ? protoCopy.sent
        : protoCopy.voided;
  const tone =
    status === "issued"
      ? "border-accent-border bg-accent-muted text-accent"
      : status === "sent"
        ? "border-divider bg-surface text-muted"
        : "border-destructive-border bg-destructive-muted text-danger";
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function FakePdfFrame({ invoice }: { invoice: DemoInvoice }) {
  return (
    <div className="flex min-h-[16rem] flex-col rounded-md border border-divider bg-background p-4 font-mono text-xs text-muted">
      <p className="mb-4 text-[10px] uppercase tracking-wide">{protoCopy.fakePdf}</p>
      <p className="text-sm text-content">{invoice.recipient}</p>
      <p className="mt-1 text-content">{invoice.invoiceNumber}</p>
      <p className="mt-4">{invoice.periodLabel}</p>
      <p className="mt-1 text-right text-base text-content">{invoice.totalLabel}</p>
    </div>
  );
}

export function EventBanner({ model }: { model: SentGatePrototypeModel }) {
  if (!model.lastEvent) return null;
  return (
    <p className={`${infoPanelClass} border-dashed`}>
      {model.lastEvent}
      <button type="button" className="ml-3 underline" onClick={model.onDismissEvent}>
        {protoCopy.dismiss}
      </button>
    </p>
  );
}

export function StateDump({ model }: { model: SentGatePrototypeModel }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-divider bg-surface p-3 text-xs text-muted">
      {protoCopy.stateLabel}:{" "}
      {JSON.stringify(
        {
          surface: model.surface,
          invoices: model.invoices.map((i) => ({
            id: i.id,
            number: i.invoiceNumber,
            status: i.status,
          })),
          lastEvent: model.lastEvent,
        },
        null,
        2,
      )}
    </pre>
  );
}

/** Shared modal/sheet surfaces — each variant opens them differently. */
export function SharedSurfaces({ model }: { model: SentGatePrototypeModel }) {
  const { surface } = model;

  if (surface.kind === "reader") {
    const inv = findInvoice(model, surface.invoiceId);
    if (!inv) return null;
    return (
      <ResponsiveOverlay
        ariaLabel={protoCopy.readerTitle}
        onBackdropClick={model.onCloseSurface}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-content">{protoCopy.readerTitle}</h2>
              <p className={metaTextClass}>
                {inv.invoiceNumber} · <StatusPill status={inv.status} />
              </p>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={model.onCloseSurface}>
              {protoCopy.close}
            </button>
          </div>
          <FakePdfFrame invoice={inv} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => model.onDownload(inv.id)}
            >
              {protoCopy.download}
            </button>
            {inv.status === "issued" ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => model.onOpenPrepare(inv.id)}
              >
                {protoCopy.prepareEmail}
              </button>
            ) : null}
          </div>
        </div>
      </ResponsiveOverlay>
    );
  }

  if (surface.kind === "edit") {
    const inv = findInvoice(model, surface.invoiceId);
    if (!inv) return null;
    return (
      <ResponsiveOverlay
        ariaLabel={protoCopy.editTitle}
        onBackdropClick={model.onCloseSurface}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const number = String(fd.get("invoiceNumber") ?? inv.invoiceNumber);
            model.onPatchInvoice(inv.id, { invoiceNumber: number });
            model.onCloseSurface();
          }}
        >
          <h2 className="text-lg font-semibold text-content">{protoCopy.editTitle}</h2>
          <p className={metaTextClass}>{protoCopy.editHint}</p>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            Invoice Number
            <input
              name="invoiceNumber"
              className={inputClass}
              defaultValue={inv.invoiceNumber}
            />
          </label>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            Recipient (stub)
            <input className={inputClass} defaultValue={inv.recipient} />
          </label>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            Billing period (stub)
            <input className={inputClass} defaultValue={inv.periodLabel} />
          </label>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            Lines / totals (stub)
            <textarea
              className={inputClass}
              rows={3}
              defaultValue={`Grouped lines…\nTotal ${inv.totalLabel}`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primaryButtonClass}>
              {protoCopy.save}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={model.onCloseSurface}
            >
              {protoCopy.cancel}
            </button>
          </div>
        </form>
      </ResponsiveOverlay>
    );
  }

  if (surface.kind === "prepare") {
    const inv = findInvoice(model, surface.invoiceId);
    if (!inv) return null;
    const mail = model.clientMail[inv.clientId];
    return (
      <ResponsiveOverlay
        ariaLabel={protoCopy.prepareConfirmTitle}
        onBackdropClick={model.onCloseSurface}
      >
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-content">
            {protoCopy.prepareConfirmTitle}
          </h2>
          <p className={metaTextClass}>{protoCopy.prepareConfirmBody}</p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{protoCopy.recipientEmail}</dt>
              <dd className="text-content">{mail?.recipientEmail ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{protoCopy.greetingName}</dt>
              <dd className="text-content">{mail?.emailGreetingName ?? "—"}</dd>
            </div>
          </dl>
          <p className={`${metaTextClass} whitespace-pre-wrap rounded-md border border-divider p-3`}>
            {mail?.invoiceEmailTemplateSubject}
            {"\n\n"}
            {mail?.invoiceEmailTemplateBody}
          </p>
          <p className={metaTextClass}>{protoCopy.attachHint}</p>
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
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={model.onCloseSurface}
            >
              {protoCopy.cancel}
            </button>
          </div>
        </div>
      </ResponsiveOverlay>
    );
  }

  if (surface.kind === "did-you-send") {
    const inv = findInvoice(model, surface.invoiceId);
    if (!inv) return null;
    return (
      <ResponsiveOverlay
        ariaLabel={protoCopy.didYouSend}
        onBackdropClick={() => model.onDidSendNo(inv.id)}
      >
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-content">{protoCopy.didYouSend}</h2>
          <p className={metaTextClass}>{protoCopy.didYouSendHint}</p>
          <p className="text-sm text-content">{inv.invoiceNumber}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => model.onDidSendYes(inv.id)}
            >
              {protoCopy.yes}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => model.onDidSendNo(inv.id)}
            >
              {protoCopy.no}
            </button>
          </div>
        </div>
      </ResponsiveOverlay>
    );
  }

  if (surface.kind === "void") {
    const inv = findInvoice(model, surface.invoiceId);
    if (!inv) return null;
    return (
      <ResponsiveOverlay
        ariaLabel={protoCopy.voidTitle}
        onBackdropClick={model.onCloseSurface}
      >
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-content">{protoCopy.voidTitle}</h2>
          <p className={metaTextClass}>{protoCopy.voidBody}</p>
          <p className="text-sm text-content">
            {inv.invoiceNumber} · {inv.periodLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={destructiveButtonClass}
              onClick={() => model.onConfirmVoid(inv.id)}
            >
              {protoCopy.voidConfirm}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={model.onCloseSurface}
            >
              {protoCopy.cancel}
            </button>
          </div>
        </div>
      </ResponsiveOverlay>
    );
  }

  if (surface.kind === "client-mail") {
    const mail = model.clientMail[surface.clientId];
    if (!mail) return null;
    return (
      <ResponsiveOverlay
        ariaLabel={protoCopy.clientMail}
        onBackdropClick={model.onCloseSurface}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            model.onSaveClientMail(surface.clientId, {
              recipientEmail: String(fd.get("recipientEmail") ?? ""),
              emailGreetingName: String(fd.get("emailGreetingName") ?? ""),
              invoiceEmailTemplateSubject: String(fd.get("subject") ?? ""),
              invoiceEmailTemplateBody: String(fd.get("body") ?? ""),
            });
          }}
        >
          <h2 className="text-lg font-semibold text-content">{protoCopy.clientMail}</h2>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            {protoCopy.recipientEmail}
            <input
              name="recipientEmail"
              className={inputClass}
              defaultValue={mail.recipientEmail}
            />
          </label>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            {protoCopy.greetingName}
            <input
              name="emailGreetingName"
              className={inputClass}
              defaultValue={mail.emailGreetingName}
            />
          </label>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            {protoCopy.templateSubject}
            <input
              name="subject"
              className={inputClass}
              defaultValue={mail.invoiceEmailTemplateSubject}
            />
          </label>
          <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
            {protoCopy.templateBody}
            <textarea
              name="body"
              className={inputClass}
              rows={5}
              defaultValue={mail.invoiceEmailTemplateBody}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primaryButtonClass}>
              {protoCopy.save}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={model.onCloseSurface}
            >
              {protoCopy.cancel}
            </button>
          </div>
        </form>
      </ResponsiveOverlay>
    );
  }

  return null;
}

export function SectionShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-content">{title}</h2>
      {children}
    </section>
  );
}
