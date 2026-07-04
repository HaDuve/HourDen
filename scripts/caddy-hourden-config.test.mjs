import { describe, expect, it } from "vitest";
import {
  ensureHourdenSseHandle,
  stripHourdenBasicAuth,
} from "./caddy-hourden-config.mjs";

const WITH_BASIC_AUTH = `# Add this to Portfolio's /opt/Portfolio/caddy/Caddyfile on VM1

hourden.hannesduve.com {
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
    expect(result).toMatch(/hourden\.hannesduve\.com/);
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
    expect(result).not.toMatch(/hourden\.hannesduve\.com[\s\S]*basic_auth/);
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
