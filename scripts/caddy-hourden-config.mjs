/**
 * Caddyfile helpers for the HourDen vhost (ADR-0009: no edge basic_auth).
 */

/**
 * Remove a `basic_auth { ... }` block from the hourden.hannesduve.com vhost only.
 * Other site blocks are left unchanged.
 *
 * @param {string} caddyfile
 * @returns {string}
 */
export function stripHourdenBasicAuth(caddyfile) {
  const lines = caddyfile.split("\n");
  const out = [];
  let inHourdenBlock = false;
  let hourdenBraceDepth = 0;
  let skippingBasicAuth = false;
  let basicAuthBraceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inHourdenBlock && /^hourden\.hannesduve\.com\s*\{/.test(trimmed)) {
      inHourdenBlock = true;
      hourdenBraceDepth = 1;
      out.push(line);
      continue;
    }

    if (inHourdenBlock) {
      if (!skippingBasicAuth && /^basic_?auth\s*\{/.test(trimmed)) {
        skippingBasicAuth = true;
        basicAuthBraceDepth = 1;
        continue;
      }

      if (skippingBasicAuth) {
        basicAuthBraceDepth += (line.match(/\{/g) ?? []).length;
        basicAuthBraceDepth -= (line.match(/\}/g) ?? []).length;
        if (basicAuthBraceDepth <= 0) {
          skippingBasicAuth = false;
        }
        continue;
      }

      hourdenBraceDepth += (line.match(/\{/g) ?? []).length;
      hourdenBraceDepth -= (line.match(/\}/g) ?? []).length;
      out.push(line);

      if (hourdenBraceDepth <= 0) {
        inHourdenBlock = false;
      }
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

const SSE_HANDLE_BLOCK = `    # SSE must not be compressed or buffered (ADR-0010).
    handle /api/events* {
        reverse_proxy host.docker.internal:3001 {
            flush_interval -1
        }
    }
`;

/**
 * Ensure the HourDen vhost proxies SSE without compression or buffering.
 *
 * @param {string} caddyfile
 * @returns {string}
 */
export function ensureHourdenSseHandle(caddyfile) {
  if (/handle \/api\/events\*/.test(caddyfile)) {
    return caddyfile;
  }

  return caddyfile.replace(
    /(hourden\.hannesduve\.com\s*\{)([\s\S]*?)(\n\})/,
    (match, open, body, close) => {
      let next = body.replace(/^\s*encode gzip zstd\s*$/m, "");

      next = next.replace(
        /(\n)(\s*)handle \/api\/\*\s*\{(\n)(?!\s*encode gzip zstd)/,
        `\n${SSE_HANDLE_BLOCK}\n$2handle /api/* {$3$2    encode gzip zstd`,
      );

      next = next.replace(
        /(\n)(\s*)handle\s*\{(\n)(?!\s*encode gzip zstd)(\s*root \* \/var\/www\/hourden)/,
        `$1$2handle {$3$2    encode gzip zstd$3$4`,
      );

      return `${open}${next}${close}`;
    },
  );
}
