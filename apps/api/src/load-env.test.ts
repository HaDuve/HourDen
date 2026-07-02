import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../../..");
const envPath = resolve(repoRoot, ".env");
const testVar = "HOURDEN_LOAD_ENV_TEST";

describe("load-env", () => {
  let envBackup: string | null = null;
  let priorValue: string | undefined;

  beforeEach(() => {
    envBackup = existsSync(envPath) ? readFileSync(envPath, "utf8") : null;
    priorValue = process.env[testVar];
    delete process.env[testVar];
    writeFileSync(envPath, `${testVar}=from-repo-dotenv\n`);
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    if (envBackup !== null) {
      writeFileSync(envPath, envBackup);
    } else if (existsSync(envPath)) {
      unlinkSync(envPath);
    }
    if (priorValue !== undefined) {
      process.env[testVar] = priorValue;
    } else {
      delete process.env[testVar];
    }
  });

  it("loads variables from the repo root .env file", async () => {
    await import("./load-env.js");

    expect(process.env[testVar]).toBe("from-repo-dotenv");
  });
});
