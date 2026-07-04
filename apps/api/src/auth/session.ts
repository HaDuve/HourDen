export const SESSION_COOKIE = "hourden_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_MS);
}

export function isSessionExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
