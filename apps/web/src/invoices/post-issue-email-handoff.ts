export const POST_ISSUE_PREPARE_EMAIL_BLINK_MS = 3000;

export function shouldBlinkPrepareEmail(
  recipientEmail: string | null | undefined,
  prefersReducedMotion: boolean,
): boolean {
  if (prefersReducedMotion) return false;
  return Boolean(recipientEmail?.trim());
}
