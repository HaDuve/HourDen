import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readIndexCss(): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.css"), "utf8");
}

/** ADR-0015 Warm Den palette (verified ≥ AA in the ADR). */
const ADR_0015_TOKENS: Record<string, string> = {
  "--color-background": "#0e0c0a",
  "--color-surface": "#16130f",
  "--color-surface-hover": "#1e1a15",
  "--color-surface-active": "#28221c",
  "--color-primary": "#f59e0b",
  "--color-primary-content": "#1c1003",
  "--color-focus": "#fcd34d",
  "--color-secondary": "#1c1814",
  "--color-secondary-hover": "#2a241e",
  "--color-secondary-content": "#d4cbc0",
  "--color-secondary-border": "#4a4036",
  "--color-input": "#14110e",
  "--color-input-border": "#6b5f52",
  "--color-divider": "#2e2822",
  "--color-content": "#ece6df",
  "--color-muted": "#a89f94",
};

const EMBER = "#f59e0b";

describe("design token foundation (index.css)", () => {
  it("matches ADR-0015 Warm Den palette tokens", () => {
    const css = readIndexCss();
    for (const [token, value] of Object.entries(ADR_0015_TOKENS)) {
      expect(css, token).toMatch(
        new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*${value}`, "i"),
      );
    }
  });

  it("uses ember for the Running Timer accent (no green running chrome)", () => {
    const css = readIndexCss();
    expect(css).toMatch(/--color-accent:\s*#f59e0b/i);
    expect(css).not.toMatch(/--color-accent:\s*#34d399/i);
    expect(css).not.toMatch(/--color-accent-border:\s*#059669/i);
  });

  it("keeps chart series off the ember hue", () => {
    const css = readIndexCss();
    const series = [...css.matchAll(/--color-chart-series-\d:\s*(#[0-9a-fA-F]{6})/g)].map(
      (match) => match[1]!.toLowerCase(),
    );
    expect(series.length).toBeGreaterThanOrEqual(6);
    expect(series).not.toContain(EMBER);
  });

  it("self-hosts a tabular display face for numeric values", () => {
    const css = readIndexCss();
    expect(css).toMatch(/@font-face/);
    expect(css).toMatch(/url\(["']\/fonts\/[^"')]+\.woff2["']\)/);
    expect(css).not.toMatch(
      /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net\/npm\/@fontsource/,
    );
    expect(css).toMatch(/--font-numeric:/);
    expect(css).toMatch(/tabular-nums/);
  });

  it("sets color-scheme dark for native form controls", () => {
    const css = readIndexCss();
    expect(css).toMatch(/color-scheme:\s*dark/);
  });
});
