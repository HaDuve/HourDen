import { createMatchMedia } from "./match-media.js";

export function mockDesktopViewport() {
  window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
}

export function mockMobileViewport() {
  window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;
}
