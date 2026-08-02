import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { infoPanelClass } from "../../layout/ui-classes.js";
import { PrototypeSwitcher } from "../archive-prototype/PrototypeSwitcher.js";
import { protoCopy } from "./copy.js";
import { DEMO_CLIENT_MAIL, DEMO_INVOICES } from "./demo-data.js";
import type {
  ClientMailSettings,
  DemoInvoice,
  SentGatePrototypeModel,
  Surface,
} from "./types.js";
import { VariantA, variantAName } from "./VariantA.js";
import { VariantB, variantBName } from "./VariantB.js";
import { VariantC, variantCName } from "./VariantC.js";

const LABELS = { A: variantAName, B: variantBName, C: variantCName } as const;

/**
 * Throwaway host for sent-gate UI variants on /prototype/sent-gate?variant=.
 * Plan: three variants — row actions+sheets / two-lane inbox / detail panel+tabs.
 */
export function SentGatePrototypeHost() {
  const [searchParams] = useSearchParams();
  const variant = (searchParams.get("variant") ?? "C").toUpperCase();

  const [invoices, setInvoices] = useState<DemoInvoice[]>(DEMO_INVOICES);
  const [clientMail, setClientMail] =
    useState<Record<string, ClientMailSettings>>(DEMO_CLIENT_MAIL);
  const [surface, setSurface] = useState<Surface>({ kind: "none" });
  const [selectedId, setSelectedId] = useState<string | null>("inv-issued-1");
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const model: SentGatePrototypeModel = useMemo(
    () => ({
      invoices,
      clientMail,
      surface,
      selectedId,
      lastEvent,
      onSelect: setSelectedId,
      onOpenReader: (id) => setSurface({ kind: "reader", invoiceId: id }),
      onOpenEdit: (id) => setSurface({ kind: "edit", invoiceId: id }),
      onOpenPrepare: (id) => setSurface({ kind: "prepare", invoiceId: id }),
      onConfirmPrepare: (id) => {
        setLastEvent(`(stub) mailto: opened + PDF download for ${id}`);
        setSurface({ kind: "did-you-send", invoiceId: id });
      },
      onDidSendYes: (id) => {
        setInvoices((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: "sent" } : i)),
        );
        setLastEvent(`Marked Sent — frozen: ${id}`);
        setSurface({ kind: "none" });
      },
      onDidSendNo: (id) => {
        setLastEvent(`Stayed Issued — still editable: ${id}`);
        setSurface({ kind: "none" });
      },
      onOpenVoid: (id) => setSurface({ kind: "void", invoiceId: id }),
      onConfirmVoid: (id) => {
        setInvoices((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: "voided" } : i)),
        );
        setLastEvent(
          `Voided ${id}. Number reserved. Entries free — Issue a replacement for that month.`,
        );
        setSurface({ kind: "none" });
        setSelectedId((cur) => (cur === id ? null : cur));
      },
      onOpenClientMail: (clientId) => setSurface({ kind: "client-mail", clientId }),
      onSaveClientMail: (clientId, next) => {
        setClientMail((prev) => ({ ...prev, [clientId]: next }));
        setLastEvent(`Saved client mail settings for ${clientId}`);
        setSurface({ kind: "none" });
      },
      onDownload: (id) => {
        setLastEvent(`(stub) PDF download: ${id}`);
      },
      onCloseSurface: () => setSurface({ kind: "none" }),
      onDismissEvent: () => setLastEvent(null),
      onPatchInvoice: (id, patch) => {
        setInvoices((prev) =>
          prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        );
        setLastEvent(`Saved edit (snapshot rewrite stub): ${id}`);
      },
    }),
    [invoices, clientMail, surface, selectedId, lastEvent],
  );

  return (
    <div className="mb-10 space-y-3">
      <div className={`${infoPanelClass} border-dashed`}>
        <strong>PROTOTYPE</strong> — {protoCopy.banner.replace(/^PROTOTYPE — /, "")}
      </div>
      {variant === "B" ? (
        <VariantB {...model} />
      ) : variant === "C" ? (
        <VariantC {...model} />
      ) : (
        <VariantA {...model} />
      )}
      <PrototypeSwitcher variants={["A", "B", "C"]} labels={LABELS} />
    </div>
  );
}
