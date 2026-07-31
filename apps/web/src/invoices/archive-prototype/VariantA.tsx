import type { ReactNode } from "react";
import {
  errorBannerClass,
  fieldLabelClass,
  infoPanelClass,
  metaTextClass,
  secondaryButtonClass,
} from "../../layout/ui-classes.js";
import { fill, protoCopy } from "./copy.js";
import type { ArchivePrototypeModel } from "./types.js";

export const variantAName = "Quiet status line";

/** Folder as muted status under Issued; banners for outcomes; zip = text link. */
export function VariantA(props: ArchivePrototypeModel) {
  return (
    <div className="space-y-4">
      <SimulateRow {...props} />
      <IssuedChrome
        title="Issued Invoices"
        filters={
          <>
            <FakeFilter label="Export client" value={props.exportClientLabel} />
            <FakeFilter label="Export year" value={props.exportYearLabel} />
          </>
        }
        trailing={null}
      >
        <ArchiveStatusLine {...props} />
        <p className="mt-2">
          <button
            type="button"
            className="text-sm text-muted underline hover:text-content"
            onClick={props.onDownloadAll}
          >
            {protoCopy.downloadAll}
          </button>
        </p>
      </IssuedChrome>
      <OutcomeBanner {...props} />
      <StateDump {...props} />
    </div>
  );
}

function ArchiveStatusLine(props: ArchivePrototypeModel) {
  const { folder } = props;
  if (folder.status === "unsupported") {
    return <p className={metaTextClass}>{protoCopy.unsupported}</p>;
  }
  if (folder.status === "unset") {
    return (
      <p className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${metaTextClass}`}>
        <span>
          {protoCopy.archiveFolder}: {protoCopy.folderUnset}
        </span>
        <button
          type="button"
          className="font-medium text-content underline"
          onClick={props.onChooseFolder}
        >
          {protoCopy.chooseFolder}
        </button>
      </p>
    );
  }
  return (
    <p className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${metaTextClass}`}>
      <span>{fill(protoCopy.folderSet, { name: folder.name })}</span>
      <button
        type="button"
        className="font-medium text-content underline"
        onClick={props.onChangeFolder}
      >
        {protoCopy.changeFolder}
      </button>
      <button
        type="button"
        className="text-danger underline"
        onClick={props.onClearFolder}
      >
        {protoCopy.clearFolder}
      </button>
    </p>
  );
}

function OutcomeBanner(props: ArchivePrototypeModel) {
  const { outcome } = props;
  if (!outcome) return null;

  if (outcome.kind === "archived") {
    return (
      <p className={`rounded-md border border-accent-border bg-accent-muted px-4 py-3 text-sm text-accent`}>
        {protoCopy.issueOkArchived}
        <button type="button" className="ml-3 underline" onClick={props.onDismissOutcome}>
          {protoCopy.dismiss}
        </button>
      </p>
    );
  }

  if (outcome.kind === "collision") {
    return (
      <p className={errorBannerClass} role="alert">
        {fill(protoCopy.issueOkCollision, { filename: outcome.filename })}
        <button type="button" className="ml-3 underline" onClick={props.onDismissOutcome}>
          {protoCopy.dismiss}
        </button>
      </p>
    );
  }

  if (outcome.kind === "needs-folder") {
    return (
      <p className={errorBannerClass} role="alert">
        {protoCopy.issueOkNeedsFolder}{" "}
        <button type="button" className="font-medium underline" onClick={props.onChooseFolder}>
          {protoCopy.chooseAndRetry}
        </button>
        <button type="button" className="ml-3 underline" onClick={props.onDismissOutcome}>
          {protoCopy.dismiss}
        </button>
      </p>
    );
  }

  return (
    <p className={errorBannerClass} role="alert">
      {protoCopy.issueOkNeedsPermission}{" "}
      <button type="button" className="font-medium underline" onClick={props.onGrantPermission}>
        {protoCopy.grantAndRetry}
      </button>
      <button type="button" className="ml-3 underline" onClick={props.onDismissOutcome}>
        {protoCopy.dismiss}
      </button>
    </p>
  );
}

function SimulateRow(props: ArchivePrototypeModel) {
  return (
    <div className={`flex flex-wrap gap-2 ${infoPanelClass}`}>
      <span className={`${fieldLabelClass} w-full`}>Demo Issue outcomes (stub)</span>
      <button type="button" className={secondaryButtonClass} onClick={() => props.onSimulate("needs-folder")}>
        {protoCopy.simulateNoFolder}
      </button>
      <button type="button" className={secondaryButtonClass} onClick={() => props.onSimulate("needs-permission")}>
        {protoCopy.simulatePermission}
      </button>
      <button type="button" className={secondaryButtonClass} onClick={() => props.onSimulate("collision")}>
        {protoCopy.simulateCollision}
      </button>
      <button type="button" className={secondaryButtonClass} onClick={() => props.onSimulate("archived")}>
        {protoCopy.simulateSuccess}
      </button>
    </div>
  );
}

function IssuedChrome({
  title,
  filters,
  trailing,
  children,
}: {
  title: string;
  filters: ReactNode;
  trailing: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-medium text-content">{title}</h2>
        <div className="flex flex-wrap items-end gap-3">
          {filters}
          {trailing}
        </div>
      </div>
      {children}
      <div className="mt-4 text-sm text-muted">
        Real issued list continues below for density.
      </div>
    </section>
  );
}

function FakeFilter({ label, value }: { label: string; value: string }) {
  return (
    <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
      {label}
      <span className="rounded-md border border-input bg-input px-3 py-2 text-sm text-muted">
        {value}
      </span>
    </label>
  );
}

function StateDump(props: ArchivePrototypeModel) {
  return (
    <pre className="overflow-x-auto rounded-md border border-divider bg-surface p-3 text-xs text-muted">
      {protoCopy.stateLabel}:{" "}
      {JSON.stringify({ folder: props.folder, outcome: props.outcome }, null, 2)}
    </pre>
  );
}

export { SimulateRow, IssuedChrome, FakeFilter, StateDump, OutcomeBanner };
