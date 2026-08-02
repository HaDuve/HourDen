import { useTranslation } from "react-i18next";
import { errorBannerClass, metaTextClass } from "../layout/ui-classes.js";
import type { ArchiveWriteResult } from "./archive-directory.js";

export type ArchiveFolderStatus =
  | { status: "unsupported" }
  | { status: "unset" }
  | { status: "set"; name: string };

type ArchiveFolderStatusLineProps = {
  folder: ArchiveFolderStatus;
  onChooseFolder: () => void;
  onChangeFolder: () => void;
  onClearFolder: () => void;
};

export function ArchiveFolderStatusLine(props: ArchiveFolderStatusLineProps) {
  const { t } = useTranslation();
  const { folder } = props;

  if (folder.status === "unsupported") {
    return <p className={metaTextClass}>{t("invoices.archiveUnsupported")}</p>;
  }

  if (folder.status === "unset") {
    return (
      <p className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${metaTextClass}`}>
        <span>
          {t("invoices.archiveFolder")}: {t("invoices.archiveFolderUnset")}
        </span>
        <button
          type="button"
          className="font-medium text-content underline"
          onClick={props.onChooseFolder}
        >
          {t("invoices.archiveChooseFolder")}
        </button>
      </p>
    );
  }

  return (
    <p className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${metaTextClass}`}>
      <span>{t("invoices.archiveFolderSet", { name: folder.name })}</span>
      <button
        type="button"
        className="font-medium text-content underline"
        onClick={props.onChangeFolder}
      >
        {t("invoices.archiveChangeFolder")}
      </button>
      <button
        type="button"
        className="text-danger underline"
        onClick={props.onClearFolder}
      >
        {t("invoices.archiveClearFolder")}
      </button>
    </p>
  );
}

type ArchiveOutcomeBannerProps = {
  outcome: ArchiveWriteResult;
  onDismiss: () => void;
  onChooseAndRetry: () => void;
  onGrantAndRetry: () => void;
};

export function ArchiveOutcomeBanner(props: ArchiveOutcomeBannerProps) {
  const { t } = useTranslation();
  const { outcome } = props;

  if (outcome.kind === "archived") {
    return (
      <p
        className="mb-4 rounded-md border border-accent-border bg-accent-muted px-4 py-3 text-sm text-accent"
        role="status"
      >
        {t("invoices.archiveIssueOkArchived")}
        <button type="button" className="ml-3 underline" onClick={props.onDismiss}>
          {t("invoices.archiveDismiss")}
        </button>
      </p>
    );
  }

  if (outcome.kind === "collision") {
    return (
      <p className={`mb-4 ${errorBannerClass}`} role="alert">
        {t("invoices.archiveIssueOkCollision", { filename: outcome.filename })}
        <button type="button" className="ml-3 underline" onClick={props.onDismiss}>
          {t("invoices.archiveDismiss")}
        </button>
      </p>
    );
  }

  if (outcome.kind === "needs-folder") {
    return (
      <p className={`mb-4 ${errorBannerClass}`} role="alert">
        {t("invoices.archiveIssueOkNeedsFolder")}{" "}
        <button
          type="button"
          className="font-medium underline"
          onClick={props.onChooseAndRetry}
        >
          {t("invoices.archiveChooseAndRetry")}
        </button>
        <button type="button" className="ml-3 underline" onClick={props.onDismiss}>
          {t("invoices.archiveDismiss")}
        </button>
      </p>
    );
  }

  if (outcome.kind === "needs-permission") {
    return (
      <p className={`mb-4 ${errorBannerClass}`} role="alert">
        {t("invoices.archiveIssueOkNeedsPermission")}{" "}
        <button
          type="button"
          className="font-medium underline"
          onClick={props.onGrantAndRetry}
        >
          {t("invoices.archiveGrantAndRetry")}
        </button>
        <button type="button" className="ml-3 underline" onClick={props.onDismiss}>
          {t("invoices.archiveDismiss")}
        </button>
      </p>
    );
  }

  if (outcome.kind === "error") {
    return (
      <p className={`mb-4 ${errorBannerClass}`} role="alert">
        {t("invoices.archiveWriteFailed")}
        <button type="button" className="ml-3 underline" onClick={props.onDismiss}>
          {t("invoices.archiveDismiss")}
        </button>
      </p>
    );
  }

  return null;
}
