import { createMatchMedia, createMatchMediaAtMinWidth } from "./match-media.js";

export function mockDesktopViewport() {
  window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
}

/** Matches Tailwind `lg` (1024px) and up — two-column Invoices layout. */
export function mockWideViewport() {
  window.matchMedia = createMatchMediaAtMinWidth(1024) as typeof window.matchMedia;
}

export function mockMobileViewport() {
  window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;
}
