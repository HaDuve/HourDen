/** Build a mailto: href (Recipient + subject + body). */
export function buildMailtoHref(
  to: string,
  subject: string,
  body: string,
): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Hand a mailto: URL to the OS mail client.
 * Use same-tab assign — not window.open(_blank). Prepare Email awaits
 * fetches first, so open() is treated as a popup (blocked or empty tab).
 */
export function openMailto(href: string): void {
  window.location.assign(href);
}
