import { Trans, useTranslation } from "react-i18next";
import { InvoicePdfToolbar } from "../layout/InvoicePdfToolbar.js";
import {
  emptyStateClass,
  infoPanelClass,
  secondaryButtonClass,
} from "../layout/ui-classes.js";
import { BlockerLink } from "./BlockerLink.js";
import type { InvoiceAlert } from "./invoice-alert.js";
import {
  invoiceBlockerHref,
  invoiceBlockerMessageKey,
} from "./invoice-blocker-link.js";
import { isQuietInvoiceConflictMessage } from "./invoice-preview-quiet.js";

type InvoicePreviewPaneProps = {
  previewing: boolean;
  previewUrl: string | null;
  previewAlert: InvoiceAlert | null;
  previewIframeSrc: (blobUrl: string) => string;
  buttonClass: string;
  onDownload: () => void;
  onFullscreen: () => void;
  onRetry?: () => void;
};

function InvoicePreviewQuietMessage({
  alert,
  onRetry,
}: {
  alert: InvoiceAlert;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();

  if (alert.kind === "blocker") {
    const href = invoiceBlockerHref(alert.code, { clientId: alert.clientId });
    const linkClassName = "font-medium underline hover:text-content";

    return (
      <p className={`${emptyStateClass} py-6`}>
        <Trans
          i18nKey={invoiceBlockerMessageKey(alert.code)}
          components={{
            actionLink: <BlockerLink to={href} className={linkClassName} />,
          }}
        />
      </p>
    );
  }

  if (isQuietInvoiceConflictMessage(alert.message)) {
    return (
      <p className={`${infoPanelClass} text-center`}>{alert.message}</p>
    );
  }

  return (
    <div className={`${emptyStateClass} space-y-3 py-6`}>
      <p>{alert.message}</p>
      {alert.canRetry && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={secondaryButtonClass}
        >
          {t("invoices.previewRetry")}
        </button>
      ) : null}
    </div>
  );
}

export function InvoicePreviewPane({
  previewing,
  previewUrl,
  previewAlert,
  previewIframeSrc,
  buttonClass,
  onDownload,
  onFullscreen,
  onRetry,
}: InvoicePreviewPaneProps) {
  const { t } = useTranslation();

  return (
    <section
      role="region"
      aria-label={t("invoices.invoicePreview")}
      className="mb-8 space-y-3"
    >
      {previewing && !previewUrl ? (
        <p className={`${emptyStateClass} py-6`}>{t("invoices.previewing")}</p>
      ) : null}

      {previewAlert ? (
        <InvoicePreviewQuietMessage alert={previewAlert} onRetry={onRetry} />
      ) : null}

      {previewUrl ? (
        <div className="space-y-3">
          <InvoicePdfToolbar
            buttonClass={buttonClass}
            fullscreenAriaLabel={t("invoices.fullscreenPreview")}
            downloadAriaLabel={t("invoices.downloadPreviewPdf")}
            onFullscreen={onFullscreen}
            onDownload={onDownload}
          />
          <iframe
            title={t("invoices.invoicePreview")}
            src={previewIframeSrc(previewUrl)}
            className="h-[70vh] w-full rounded-md border border-divider"
          />
        </div>
      ) : null}
    </section>
  );
}
