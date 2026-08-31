/**
 * Caddyfile helpers for the HourDen vhost (ADR-0009: no edge basic_auth).
 */

export const HOURDEN_APEX_HOST = "hourden.com";
export const HOURDEN_WWW_HOST = "www.hourden.com";
export const HOURDEN_LEGACY_HOST = "hourden.hannesduve.com";

const APP_VHOST_HOSTS = [HOURDEN_APEX_HOST, HOURDEN_LEGACY_HOST];

function isHourdenAppVhostLine(trimmed) {
  return APP_VHOST_HOSTS.some(
    (host) => new RegExp(`^${host.replace(/\./g, "\\.")}\\s*\\{`).test(trimmed),
  );
}

/**
 * Remove a `basic_auth { ... }` block from HourDen app vhosts only.
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

    if (!inHourdenBlock && isHourdenAppVhostLine(trimmed)) {
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

function hourdenAppVhostPattern() {
  const hosts = APP_VHOST_HOSTS.map((host) => host.replace(/\./g, "\\.")).join(
    "|",
  );
  return new RegExp(`(${hosts})\\s*\\{([\\s\\S]*?)(\\n\\})`, "g");
}

/**
 * Ensure HourDen app vhosts proxy SSE without compression or buffering.
 *
 * @param {string} caddyfile
 * @returns {string}
 */
export function ensureHourdenSseHandle(caddyfile) {
  if (/handle \/api\/events\*/.test(caddyfile)) {
    return caddyfile;
  }

  return caddyfile.replace(hourdenAppVhostPattern(), (match, open, body, close) => {
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
  });
}

const APP_VHOST_BLOCK = `${HOURDEN_APEX_HOST} {
    # SSE must not be compressed or buffered (ADR-0010).
    handle /api/events* {
        reverse_proxy host.docker.internal:3001 {
            flush_interval -1
        }
    }

    handle /api/* {
        encode gzip zstd
        reverse_proxy host.docker.internal:3001
    }

    handle {
        encode gzip zstd
        root * /var/www/hourden
        try_files {path} /index.html
        file_server
    }

    log {
        output file /var/log/caddy/hourden-access.log {
            roll_size 50mb
            roll_keep 12
            roll_keep_for 8760h
        }
        format json
    }
}`;

const REDIRECT_VHOST = (host) => `${host} {
    redir https://${HOURDEN_APEX_HOST}{uri} permanent
}`;

/**
 * Caddyfile blocks for HourDen on the canonical apex domain.
 *
 * @returns {string}
 */
export function buildHourdenCaddySnippet() {
  return [
    APP_VHOST_BLOCK,
    REDIRECT_VHOST(HOURDEN_WWW_HOST),
    REDIRECT_VHOST(HOURDEN_LEGACY_HOST),
  ].join("\n\n");
}
