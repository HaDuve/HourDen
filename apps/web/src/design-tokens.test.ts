import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readIndexCss(): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.css"), "utf8");
}

describe("design token foundation (index.css)", () => {
  it("documents font-mono / tabular-nums convention for numeric and time values", () => {
    const css = readIndexCss();
    expect(css).toMatch(/font-mono/);
    expect(css).toMatch(/tabular-nums/);
  });

  it("sets color-scheme dark for native form controls", () => {
    const css = readIndexCss();
    expect(css).toMatch(/color-scheme:\s*dark/);
  });
});
