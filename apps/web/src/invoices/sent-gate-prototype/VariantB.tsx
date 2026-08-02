import type { ReactNode } from "react";
import {
  cardClass,
  metaTextClass,
  primaryButtonClass,
  secondaryButtonClass,
  destructiveOutlineButtonClass,
} from "../../layout/ui-classes.js";
import { protoCopy } from "./copy.js";
import {
  EventBanner,
  SharedSurfaces,
  StateDump,
  StatusPill,
} from "./SharedSurfaces.js";
import type { DemoInvoice, SentGatePrototypeModel } from "./types.js";

export const variantBName = "Two-lane inbox";

/**
 * Split Ready-to-send vs Already-sent.
 * Issued rows lead with Prepare Email; sent lane is quieter (Reader / Void).
 * “Did you send?” uses a sticky bottom strip instead of a centered modal.
 */
export function VariantB(model: SentGatePrototypeModel) {
  const ready = model.invoices.filter((i) => i.status === "issued");
  const sent = model.invoices.filter((i) => i.status === "sent");
  const surface = model.surface;
  const showDidSend = surface.kind === "did-you-send";
  const didSendInv =
    surface.kind === "did-you-send"
      ? model.invoices.find((i) => i.id === surface.invoiceId)
      : undefined;

  return (
    <div className="mb-24 space-y-6">
      <EventBanner model={model} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Lane
          title={protoCopy.readyLane}
          empty="Nothing waiting to send."
          items={ready.map((inv) => (
            <ReadyCard key={inv.id} inv={inv} model={model} />
          ))}
        />
        <Lane
          title={protoCopy.sentLane}
          empty="No sent invoices yet."
          items={sent.map((inv) => (
            <SentCard key={inv.id} inv={inv} model={model} />
          ))}
        />
      </div>
      <p className={metaTextClass}>
        Voided invoices stay out of both lanes. Client email settings open from Prepare.
      </p>
      {/* Variant B: suppress shared did-you-send modal — use sticky strip */}
      <SharedSurfaces
        model={{
          ...model,
          surface:
            model.surface.kind === "did-you-send" ? { kind: "none" } : model.surface,
        }}
      />
      {showDidSend && didSendInv ? (
        <div className="fixed bottom-16 left-1/2 z-[90] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-divider bg-content px-4 py-3 text-background shadow-lg">
          <p className="font-medium">{protoCopy.didYouSend}</p>
          <p className="mt-1 text-sm opacity-80">
            {didSendInv.invoiceNumber} — {protoCopy.didYouSendHint}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-background px-3 py-1.5 text-sm font-medium text-content"
              onClick={() => model.onDidSendYes(didSendInv.id)}
            >
              {protoCopy.yes}
            </button>
            <button
              type="button"
              className="rounded-md border border-background/40 px-3 py-1.5 text-sm"
              onClick={() => model.onDidSendNo(didSendInv.id)}
            >
              {protoCopy.no}
            </button>
          </div>
        </div>
      ) : null}
      <StateDump model={model} />
    </div>
  );
}

function Lane({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: ReactNode;
}) {
  const hasItems = Array.isArray(items) ? items.length > 0 : Boolean(items);
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-content">{title}</h2>
      {hasItems ? <ul className="space-y-3">{items}</ul> : <p className={metaTextClass}>{empty}</p>}
    </section>
  );
}

function ReadyCard({
  inv,
  model,
}: {
  inv: DemoInvoice;
  model: SentGatePrototypeModel;
}) {
  return (
    <li className={`${cardClass} space-y-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-content">{inv.recipient}</p>
          <p className={metaTextClass}>
            {inv.invoiceNumber} · {inv.periodLabel}
          </p>
        </div>
        <StatusPill status={inv.status} />
      </div>
      <p className="text-right font-mono text-content">{inv.totalLabel}</p>
      <button
        type="button"
        className={`${primaryButtonClass} w-full`}
        onClick={() => model.onOpenPrepare(inv.id)}
      >
        {protoCopy.primarySend}
      </button>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => model.onOpenReader(inv.id)}
        >
          {protoCopy.reader}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => model.onOpenEdit(inv.id)}
        >
          {protoCopy.edit}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => model.onDownload(inv.id)}
        >
          {protoCopy.download}
        </button>
      </div>
    </li>
  );
}

function SentCard({
  inv,
  model,
}: {
  inv: DemoInvoice;
  model: SentGatePrototypeModel;
}) {
  return (
    <li className={`${cardClass} space-y-2 p-4 opacity-90`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-content">{inv.recipient}</p>
          <p className={metaTextClass}>
            {inv.invoiceNumber} · {inv.periodLabel}
          </p>
        </div>
        <StatusPill status={inv.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => model.onOpenReader(inv.id)}
        >
          {protoCopy.reader}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => model.onDownload(inv.id)}
        >
          {protoCopy.download}
        </button>
        <button
          type="button"
          className={destructiveOutlineButtonClass + " px-3 py-1.5 text-sm"}
          onClick={() => model.onOpenVoid(inv.id)}
        >
          {protoCopy.replacePath}
        </button>
      </div>
    </li>
  );
}
