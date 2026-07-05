import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shellAndNavFiles = [
  "../App.tsx",
  "./app-navigation.tsx",
  "./nav-link-class.ts",
  "./tracker-nav-link.tsx",
  "../layout/LanguageSwitcher.tsx",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

// Raw Tailwind color utilities and hex literals the shell/nav must not use.
// Screens reference semantic tokens (ADR-0012), not raw palette values.
const bannedRawColorPatterns: RegExp[] = [
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:neutral|slate|zinc|gray|stone)-\d/,
  /\b(?:bg|text|border|ring)-white\b/,
  /\b(?:bg|text|border|ring)-black\b/,
  /\bbg-black\//,
  /\b(?:bg|text|border|ring)-(?:red|green|amber|blue|indigo|sky)-\d/,
  /#[0-9a-fA-F]{3,8}\b/,
];

describe("shell/nav use semantic tokens, not raw color utilities", () => {
  for (const relativePath of shellAndNavFiles) {
    it(`${relativePath} has no raw color utilities`, () => {
      const source = readSource(relativePath);
      for (const pattern of bannedRawColorPatterns) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  it("nav chrome references semantic surface/background tokens", () => {
    const nav = readSource("./app-navigation.tsx");
    expect(nav).toMatch(/\b(?:bg|border)-(?:background|surface|divider)\b/);
  });
});
