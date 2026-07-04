import { describe, expect, it } from "vitest";
import { resolveLocale } from "./resolve-locale.js";

describe("resolveLocale", () => {
  it("prefers the User record over localStorage and Accept-Language", () => {
    expect(
      resolveLocale({
        userLocale: "de",
        storedLocale: "en",
        acceptLanguage: "en-US,en;q=0.9",
      }),
    ).toBe("de");
  });

  it("falls back to localStorage when the User has no Language set", () => {
    expect(
      resolveLocale({
        userLocale: null,
        storedLocale: "de",
        acceptLanguage: "en-US,en;q=0.9",
      }),
    ).toBe("de");
  });

  it("falls back to Accept-Language when User and localStorage are empty", () => {
    expect(
      resolveLocale({
        userLocale: null,
        storedLocale: null,
        acceptLanguage: "de-DE,de;q=0.9",
      }),
    ).toBe("de");
  });

  it("defaults to en when nothing else matches", () => {
    expect(
      resolveLocale({
        userLocale: null,
        storedLocale: null,
        acceptLanguage: "fr-FR",
      }),
    ).toBe("en");
  });
});
