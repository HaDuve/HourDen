import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { infoPanelClass } from "../../layout/ui-classes.js";
import { PrototypeSwitcher } from "./PrototypeSwitcher.js";
import { VariantA, variantAName } from "./VariantA.js";
import { VariantB, variantBName } from "./VariantB.js";
import { VariantC, variantCName } from "./VariantC.js";
import { DEMO_FILENAME, type ArchiveFolderState, type IssueOutcome } from "./types.js";
import type { ArchivePrototypeModel } from "./types.js";

const LABELS = { A: variantAName, B: variantBName, C: variantCName } as const;

/**
 * Throwaway host for archive UI variants on /prototype?variant=.
 * Plan: three variants — quiet line / setup panel+modal / Issue-adjacent chip.
 */
export function ArchivePrototypeHost() {
  const [searchParams] = useSearchParams();
  const variant = (searchParams.get("variant") ?? "A").toUpperCase();

  const [folder, setFolder] = useState<ArchiveFolderState>({
    status: "set",
    name: "Outgoing",
    permission: "granted",
  });
  const [outcome, setOutcome] = useState<IssueOutcome>(null);

  const model: ArchivePrototypeModel = useMemo(
    () => ({
      folder,
      outcome,
      exportClientLabel: "All clients",
      exportYearLabel: "All years",
      onChooseFolder: () => {
        setFolder({ status: "set", name: "Outgoing", permission: "granted" });
        if (
          outcome?.kind === "needs-folder" ||
          outcome?.kind === "needs-permission"
        ) {
          setOutcome({ kind: "archived", filename: DEMO_FILENAME });
        }
      },
      onChangeFolder: () => {
        setFolder({ status: "set", name: "Invoices-Archive", permission: "granted" });
      },
      onClearFolder: () => {
        setFolder({ status: "unset" });
        setOutcome(null);
      },
      onGrantPermission: () => {
        if (folder.status === "set") {
          setFolder({ ...folder, permission: "granted" });
        }
        setOutcome({ kind: "archived", filename: DEMO_FILENAME });
      },
      onRetryFile: () => {
        setOutcome({ kind: "archived", filename: DEMO_FILENAME });
      },
      onDismissOutcome: () => setOutcome(null),
      onDownloadAll: () => {
        window.alert("(prototype) would download Outgoing.zip");
      },
      onSimulate: (kind) => {
        if (kind === "needs-folder") {
          setFolder({ status: "unset" });
          setOutcome({ kind: "needs-folder", filename: DEMO_FILENAME });
          return;
        }
        if (kind === "needs-permission") {
          setFolder({ status: "set", name: "Outgoing", permission: "prompt" });
          setOutcome({ kind: "needs-permission", filename: DEMO_FILENAME });
          return;
        }
        if (kind === "collision") {
          setFolder({ status: "set", name: "Outgoing", permission: "granted" });
          setOutcome({ kind: "collision", filename: DEMO_FILENAME });
          return;
        }
        setFolder({ status: "set", name: "Outgoing", permission: "granted" });
        setOutcome({ kind: "archived", filename: DEMO_FILENAME });
      },
    }),
    [folder, outcome],
  );

  return (
    <div className="mb-10 space-y-3">
      <div className={`${infoPanelClass} border-dashed`}>
        <strong>PROTOTYPE</strong> — archive folder + Issue-prompt UI (throwaway).{" "}
        Open <code className="text-xs">/prototype?variant=A|B|C</code>; flip with the bar
        or ← →. See <code className="text-xs">NOTES.md</code>.
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
