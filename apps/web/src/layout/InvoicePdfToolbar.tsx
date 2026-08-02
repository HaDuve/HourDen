import { useTranslation } from "react-i18next";
import Download from "lucide-react/icons/download";
import Maximize2 from "lucide-react/icons/maximize-2";

const TOOLBAR_ICON_SIZE = 16;
const TOOLBAR_ICON_STROKE = 1.75;

type InvoicePdfToolbarProps = {
  className?: string;
  buttonClass: string;
  onDownload: () => void;
  onFullscreen?: () => void;
  onClose?: () => void;
  fullscreenAriaLabel?: string;
  downloadAriaLabel: string;
  closeAriaLabel?: string;
  downloadDisabled?: boolean;
  downloading?: boolean;
};

export function InvoicePdfToolbar({
  className = "flex justify-end gap-2",
  buttonClass,
  onDownload,
  onFullscreen,
  onClose,
  fullscreenAriaLabel,
  downloadAriaLabel,
  closeAriaLabel,
  downloadDisabled = false,
  downloading = false,
}: InvoicePdfToolbarProps) {
  const { t } = useTranslation();
  const iconButtonClass = `${buttonClass} inline-flex items-center gap-1.5`;

  return (
    <div className={className}>
      {onFullscreen ? (
        <button
          type="button"
          onClick={onFullscreen}
          className={iconButtonClass}
          aria-label={fullscreenAriaLabel}
        >
          <Maximize2
            size={TOOLBAR_ICON_SIZE}
            strokeWidth={TOOLBAR_ICON_STROKE}
            aria-hidden
            className="shrink-0"
          />
          {t("invoices.fullscreen")}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDownload}
        className={iconButtonClass}
        aria-label={downloadAriaLabel}
        disabled={downloadDisabled}
      >
        <Download
          size={TOOLBAR_ICON_SIZE}
          strokeWidth={TOOLBAR_ICON_STROKE}
          aria-hidden
          className="shrink-0"
        />
        {downloading ? t("invoices.downloading") : t("invoices.download")}
      </button>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className={iconButtonClass}
          aria-label={closeAriaLabel}
        >
          {t("nav.close")}
        </button>
      ) : null}
    </div>
  );
}
