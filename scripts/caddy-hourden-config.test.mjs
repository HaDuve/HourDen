import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyHourdenDomainCutover,
  buildHourdenCaddySnippet,
  ensureHourdenSseHandle,
  stripHourdenBasicAuth,
} from "./caddy-hourden-config.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const WITH_BASIC_AUTH = `# Add this to Portfolio's /opt/Portfolio/caddy/Caddyfile on VM1

hourden.com {
    basic_auth {
        operator $2a$14$Hhcab4yh26gYSIWyztWgPuU0kfsJ2kx9D46jDfXRJjESEPaUtGgyS
    }

    encode gzip zstd

    handle /api/* {
        reverse_proxy host.docker.internal:3001
    }

    handle {
        root * /var/www/hourden
        try_files {path} /index.html
        file_server
    }
}
`;

describe("stripHourdenBasicAuth", () => {
  it("includes SPA fallback so deep links resolve to index.html", () => {
    expect(WITH_BASIC_AUTH).toMatch(/try_files \{path\} \/index.html/);
    expect(WITH_BASIC_AUTH).toMatch(/handle \/api\/\*/);
  });

  it("removes basic_auth from the HourDen vhost block", () => {
    const result = stripHourdenBasicAuth(WITH_BASIC_AUTH);

    expect(result).not.toMatch(/basic_auth/);
    expect(result).toMatch(/hourden\.com/);
    expect(result).toMatch(/encode gzip zstd/);
    expect(result).toMatch(/reverse_proxy host\.docker\.internal:3001/);
  });

  it("removes legacy basicauth from the HourDen vhost block", () => {
    const input = WITH_BASIC_AUTH.replace("basic_auth", "basicauth");
    const result = stripHourdenBasicAuth(input);

    expect(result).not.toMatch(/basicauth/);
    expect(result).toMatch(/encode gzip zstd/);
  });

  it("leaves other vhosts unchanged", () => {
    const input = `hannesduve.com {
    basic_auth {
        visitor $2a$14$abc
    }
    file_server
}

${WITH_BASIC_AUTH}`;

    const result = stripHourdenBasicAuth(input);

    expect(result).toMatch(/hannesduve\.com[\s\S]*basic_auth/);
    expect(result).not.toMatch(/hourden\.com[\s\S]*basic_auth/);
  });
});

describe("ensureHourdenSseHandle", () => {
  it("adds an unbuffered /api/events handle before the general API proxy", () => {
    const input = stripHourdenBasicAuth(WITH_BASIC_AUTH);
    const result = ensureHourdenSseHandle(input);

    expect(result).toMatch(/handle \/api\/events\*/);
    expect(result).toMatch(/flush_interval -1/);
    expect(result.indexOf("handle /api/events*")).toBeLessThan(
      result.indexOf("handle /api/*"),
    );
  });

  it("leaves an already-patched HourDen vhost unchanged", () => {
    const patched = ensureHourdenSseHandle(stripHourdenBasicAuth(WITH_BASIC_AUTH));
    expect(ensureHourdenSseHandle(patched)).toBe(patched);
  });
});

describe("buildHourdenCaddySnippet", () => {
  it("defines hourden.com as the app vhost with SSE, API proxy, and SPA fallback", () => {
    const snippet = buildHourdenCaddySnippet();

    expect(snippet).toMatch(/^hourden\.com \{/m);
    expect(snippet).toMatch(/handle \/api\/events\*/);
    expect(snippet).toMatch(/flush_interval -1/);
    expect(snippet).toMatch(/handle \/api\/\*/);
    expect(snippet).toMatch(/reverse_proxy host\.docker\.internal:3001/);
    expect(snippet).toMatch(/try_files \{path\} \/index.html/);
    expect(snippet.indexOf("handle /api/events*")).toBeLessThan(
      snippet.indexOf("handle /api/*"),
    );
  });

  it("redirects www and the legacy subdomain to the apex with 301", () => {
    const snippet = buildHourdenCaddySnippet();

    expect(snippet).toMatch(/www\.hourden\.com \{[\s\S]*redir https:\/\/hourden\.com\{uri\} permanent/);
    expect(snippet).toMatch(/hourden\.hannesduve\.com \{[\s\S]*redir https:\/\/hourden\.com\{uri\} permanent/);
  });

  it("matches .caddy-snippet.txt blocks", () => {
    const file = readFileSync(join(repoRoot, ".caddy-snippet.txt"), "utf8");
    const blocks = file
      .replace(/\r\n/g, "\n")
      .replace(/^#.*\n/gm, "")
      .trim();

    expect(blocks).toBe(buildHourdenCaddySnippet());
  });
});

const LEGACY_APP_VHOST = `hannesduve.com {
    file_server
}

hourden.hannesduve.com {
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
}
`;

describe("applyHourdenDomainCutover", () => {
  it("replaces a legacy app vhost with a redirect and appends apex plus www without duplicating legacy", () => {
    const result = applyHourdenDomainCutover(LEGACY_APP_VHOST);

    expect(result).toMatch(/^hourden\.com \{/m);
    expect(result).toMatch(/www\.hourden\.com \{[\s\S]*redir https:\/\/hourden\.com\{uri\} permanent/);
    expect(result).toMatch(/hourden\.hannesduve\.com \{[\s\S]*redir https:\/\/hourden\.com\{uri\} permanent/);
    expect(result).not.toMatch(/reverse_proxy host\.docker\.internal:3001[\s\S]*hourden\.hannesduve\.com/);
    expect((result.match(/^hourden\.hannesduve\.com \{/gm) ?? []).length).toBe(1);
  });

  it("appends the full snippet when no HourDen vhosts exist yet", () => {
    const result = applyHourdenDomainCutover("hannesduve.com {\n    file_server\n}\n");

    expect(result.trimEnd()).toBe(
      `hannesduve.com {
    file_server
}

${buildHourdenCaddySnippet()}`.trimEnd(),
    );
  });

  it("leaves the Caddyfile unchanged when the apex vhost already exists", () => {
    const existing = `${buildHourdenCaddySnippet()}\n`;

    expect(applyHourdenDomainCutover(existing)).toBe(existing);
  });

  it("rejects duplicate legacy vhost blocks", () => {
    const duplicate = `${LEGACY_APP_VHOST}

hourden.hannesduve.com {
    redir https://hourden.com{uri} permanent
}`;

    expect(() => applyHourdenDomainCutover(duplicate)).toThrow(/duplicate/i);
  });
});
