import type { ReactNode } from "react";
import { useIsMobile } from "./use-is-mobile.js";

type ResponsiveOverlayProps = {
  children: ReactNode;
  ariaLabel: string;
  labelledBy?: string;
  onBackdropClick?: () => void;
};

export function ResponsiveOverlay({
  children,
  ariaLabel,
  labelledBy,
  onBackdropClick,
}: ResponsiveOverlayProps) {
  const isMobile = useIsMobile();
  const presentation = isMobile ? "sheet" : "modal";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labelledBy ? undefined : ariaLabel}
      aria-labelledby={labelledBy}
      data-presentation={presentation}
      className={
        isMobile
          ? "fixed inset-0 z-40 flex items-end bg-black/40"
          : "fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      }
      onClick={(event) => {
        if (onBackdropClick && event.target === event.currentTarget) {
          onBackdropClick();
        }
      }}
    >
      <div
        className={
          isMobile
            ? "max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-neutral-200 bg-white p-4 shadow-lg"
            : "w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-lg"
        }
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
