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

function vhostBlockPattern(host) {
  const escaped = host.replace(/\./g, "\\.");
  return new RegExp(`^${escaped}\\s*\\{[\\s\\S]*?\\n\\}`, "m");
}

function countVhostBlocks(caddyfile, host) {
  const escaped = host.replace(/\./g, "\\.");
  return (caddyfile.match(new RegExp(`^${escaped}\\s*\\{`, "gm")) ?? []).length;
}

function hasHourdenApexVhost(caddyfile) {
  return /^hourden\.com\s*\{/m.test(caddyfile);
}

function hasLegacyVhost(caddyfile) {
  return /^hourden\.hannesduve\.com\s*\{/m.test(caddyfile);
}

function getVhostBody(caddyfile, host) {
  const match = caddyfile.match(vhostBlockPattern(host));
  if (!match) {
    return null;
  }

  const blockMatch = match[0].match(/^\S+\s*\{([\s\S]*)\n\}$/);
  return blockMatch ? blockMatch[1] : null;
}

function isLegacyAppVhost(caddyfile) {
  const body = getVhostBody(caddyfile, HOURDEN_LEGACY_HOST);
  if (!body) {
    return false;
  }

  const isRedirectOnly =
    /redir\s+https:\/\/hourden\.com\{uri\}\s+permanent/.test(body) &&
    !/reverse_proxy|file_server|handle \/api/.test(body);

  return !isRedirectOnly;
}

function replaceVhostBlock(caddyfile, host, newBlock) {
  const pattern = vhostBlockPattern(host);
  if (!pattern.test(caddyfile)) {
    throw new Error(`Missing vhost block for ${host}`);
  }

  return caddyfile.replace(pattern, newBlock);
}

function blocksForCutoverAppend(caddyfile) {
  const blocks = [APP_VHOST_BLOCK, REDIRECT_VHOST(HOURDEN_WWW_HOST)];
  if (!hasLegacyVhost(caddyfile)) {
    blocks.push(REDIRECT_VHOST(HOURDEN_LEGACY_HOST));
  }
  return blocks;
}

/**
 * Apply HourDen domain cutover blocks to a Portfolio Caddyfile.
 * Replaces an existing legacy app vhost with a redirect before append
 * so duplicate site labels cannot appear on reload.
 *
 * @param {string} caddyfile
 * @returns {string}
 */
export function applyHourdenDomainCutover(caddyfile) {
  if (hasHourdenApexVhost(caddyfile)) {
    return caddyfile;
  }

  if (countVhostBlocks(caddyfile, HOURDEN_LEGACY_HOST) > 1) {
    throw new Error(
      `Duplicate ${HOURDEN_LEGACY_HOST} vhost blocks in Caddyfile`,
    );
  }

  let next = caddyfile;

  if (isLegacyAppVhost(next)) {
    next = replaceVhostBlock(
      next,
      HOURDEN_LEGACY_HOST,
      REDIRECT_VHOST(HOURDEN_LEGACY_HOST),
    );
  }

  const blocksToAppend = blocksForCutoverAppend(next);
  return `${next.trimEnd()}\n\n${blocksToAppend.join("\n\n")}\n`;
}

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
