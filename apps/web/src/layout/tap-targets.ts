import { primaryButtonClass, secondaryButtonClass } from "./ui-classes.js";
import { useIsMobile } from "./use-is-mobile.js";

const outlineActionBase =
  "rounded-md border border-secondary-border bg-secondary text-secondary-content hover:bg-secondary-hover";

export function mobileActionButtonClass(isMobile: boolean): string {
  return isMobile
    ? `min-h-11 ${outlineActionBase} px-4 text-sm`
    : `${outlineActionBase} px-3 py-1.5 text-sm`;
}

export function mobilePrimaryButtonClass(isMobile: boolean): string {
  return isMobile ? `min-h-11 ${primaryButtonClass}` : primaryButtonClass;
}

export function mobileSecondaryButtonClass(isMobile: boolean): string {
  return isMobile ? `min-h-11 ${secondaryButtonClass}` : secondaryButtonClass;
}

export function useMobileActionButtonClass(): string {
  return mobileActionButtonClass(useIsMobile());
}

export function useMobilePrimaryButtonClass(): string {
  return mobilePrimaryButtonClass(useIsMobile());
}

export function useMobileSecondaryButtonClass(): string {
  return mobileSecondaryButtonClass(useIsMobile());
}
