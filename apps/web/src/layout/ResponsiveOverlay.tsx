import type { ReactNode } from "react";
import { cardClass } from "./ui-classes.js";
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
          ? "fixed inset-0 z-40 flex items-end bg-background/80"
          : "fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4"
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
            ? `max-h-[90vh] w-full overflow-y-auto rounded-t-xl p-4 shadow-lg ${cardClass}`
            : `w-full max-w-lg rounded-xl p-6 shadow-lg ${cardClass}`
        }
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
