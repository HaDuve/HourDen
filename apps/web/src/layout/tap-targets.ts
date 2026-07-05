import { useIsMobile } from "./use-is-mobile.js";

export function mobileActionButtonClass(isMobile: boolean): string {
  return isMobile
    ? "min-h-11 rounded-md border px-4 text-sm"
    : "rounded-md border px-3 py-1.5 text-sm";
}

export function mobilePrimaryButtonClass(isMobile: boolean): string {
  return isMobile
    ? "min-h-11 rounded-lg px-4 py-2 text-sm font-medium"
    : "rounded-lg px-4 py-2 text-sm font-medium";
}

export function useMobileActionButtonClass(): string {
  return mobileActionButtonClass(useIsMobile());
}

export function useMobilePrimaryButtonClass(): string {
  return mobilePrimaryButtonClass(useIsMobile());
}
