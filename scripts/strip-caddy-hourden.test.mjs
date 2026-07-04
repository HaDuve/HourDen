import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const WITH_BASIC_AUTH = `hourden.hannesduve.com {
    basic_auth {
        operator hash
    }
    encode gzip zstd
}
`;

describe("strip-caddy-hourden.mjs CLI", () => {
  it("rewrites a Caddyfile in place using stripHourdenBasicAuth", () => {
    const dir = mkdtempSync(join(tmpdir(), "hourden-caddy-"));
    const caddyfile = join(dir, "Caddyfile");
    writeFileSync(caddyfile, WITH_BASIC_AUTH, "utf8");

    execFileSync(
      process.execPath,
      [join(repoRoot, "scripts/strip-caddy-hourden.mjs"), caddyfile],
      { cwd: repoRoot },
    );

    const result = readFileSync(caddyfile, "utf8");
    expect(result).not.toMatch(/basic_auth/);
    expect(result).toMatch(/encode gzip zstd/);
  });
});
