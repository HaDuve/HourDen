import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectScreenFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test" || entry.name === "i18n" || entry.name === "locale") {
        continue;
      }
      collectScreenFiles(path, acc);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".tsx") &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".integration.test.")
    ) {
      acc.push(path);
    }
  }
  return acc;
}

const screenFiles = collectScreenFiles(srcRoot).sort();

// Raw Tailwind color utilities and hex literals screens must not use.
// Screens reference semantic tokens (ADR-0012), not raw palette values.
const bannedRawColorPatterns: RegExp[] = [
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:neutral|slate|zinc|gray|stone)-\d/,
  /\b(?:bg|text|border|ring)-white\b/,
  /\b(?:bg|text|border|ring)-black\b/,
  /\bbg-black\//,
  /\b(?:bg|text|border|ring)-(?:red|green|amber|emerald|blue|indigo|sky)-\d/,
  /#[0-9a-fA-F]{3,8}\b/,
];

describe("screens use semantic tokens, not raw color utilities", () => {
  for (const absolutePath of screenFiles) {
    const label = relative(srcRoot, absolutePath);
    it(`${label} has no raw color utilities`, () => {
      const source = readFileSync(absolutePath, "utf8");
      for (const pattern of bannedRawColorPatterns) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  it("nav chrome references semantic surface/background tokens", () => {
    const nav = readFileSync(join(srcRoot, "navigation/app-navigation.tsx"), "utf8");
    expect(nav).toMatch(/\b(?:bg|border)-(?:background|surface|divider)\b/);
  });

  it("app shell root uses bg-background token", () => {
    const app = readFileSync(join(srcRoot, "App.tsx"), "utf8");
    expect(app).toMatch(/\bbg-background\b/);
  });
});
