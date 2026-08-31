export const DEFAULT_PUBLIC_URL = "https://hourden.com";

/**
 * Canonical public URL for scripts and production verification.
 * Prefers HOURDEN_PUBLIC_URL; accepts deprecated HOURDEN_BASE_URL as alias.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolvePublicUrl(env = process.env) {
  return (
    env.HOURDEN_PUBLIC_URL ??
    env.HOURDEN_BASE_URL ??
    DEFAULT_PUBLIC_URL
  );
}
