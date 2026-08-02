import {
  metaTextClass,
  primaryButtonClass,
  secondaryButtonClass,
  destructiveOutlineButtonClass,
} from "../../layout/ui-classes.js";
import { protoCopy } from "./copy.js";
import {
  EventBanner,
  SharedSurfaces,
  SectionShell,
  StateDump,
  StatusPill,
} from "./SharedSurfaces.js";
import type { DemoInvoice, SentGatePrototypeModel } from "./types.js";

export const variantAName = "Row actions + sheets";

/**
 * Flat issued list (today’s shape) + status column.
 * Actions live on the row; Reader/Edit/Prepare/Void all open overlays.
 */
export function VariantA(model: SentGatePrototypeModel) {
  const visible = model.invoices.filter((i) => i.status !== "voided");
  return (
    <div className="space-y-4">
      <EventBanner model={model} />
      <SectionShell title="Issued invoices">
        <div className="overflow-x-auto rounded-md border border-divider">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-hover text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((inv) => (
                <Row key={inv.id} inv={inv} model={model} />
              ))}
            </tbody>
          </table>
        </div>
        <p className={`mt-2 ${metaTextClass}`}>
          Voided rows hidden from list (still reserved numbers). Client mail fields live
          behind Prepare Email → “Client email settings”.
        </p>
      </SectionShell>
      <SharedSurfaces model={model} />
      <StateDump model={model} />
    </div>
  );
}

function Row({
  inv,
  model,
}: {
  inv: DemoInvoice;
  model: SentGatePrototypeModel;
}) {
  return (
    <tr className="border-t border-divider hover:bg-surface-hover">
      <td className="px-4 py-3 text-content">{inv.recipient}</td>
      <td className="px-4 py-3 text-content">{inv.invoiceNumber}</td>
      <td className={`px-4 py-3 ${metaTextClass}`}>{inv.periodLabel}</td>
      <td className="px-4 py-3">
        <StatusPill status={inv.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
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
          {inv.status === "issued" ? (
            <>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => model.onOpenEdit(inv.id)}
              >
                {protoCopy.edit}
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => model.onOpenPrepare(inv.id)}
              >
                {protoCopy.prepareEmail}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={destructiveOutlineButtonClass + " px-3 py-1.5 text-sm"}
              onClick={() => model.onOpenVoid(inv.id)}
            >
              {protoCopy.voidReplace}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
