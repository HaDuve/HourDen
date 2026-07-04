import { describe, expect, it } from "vitest";
import { parseAcceptLanguage } from "@hourden/domain";

describe("parseAcceptLanguage", () => {
  it("returns en when the header is missing", () => {
    expect(parseAcceptLanguage(undefined)).toBe("en");
  });

  it("prefers de when German is listed first", () => {
    expect(parseAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
  });

  it("returns en for unsupported languages", () => {
    expect(parseAcceptLanguage("fr-FR,fr;q=0.9")).toBe("en");
  });

  it("prefers the highest q value among supported languages", () => {
    expect(parseAcceptLanguage("en;q=0.1,de;q=0.9")).toBe("de");
  });
});
