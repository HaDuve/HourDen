import { describe, expect, it } from "vitest";
import { resolvePublicUrl } from "./hourden-public-url.mjs";

describe("resolvePublicUrl", () => {
  it("uses HOURDEN_PUBLIC_URL when set", () => {
    expect(
      resolvePublicUrl({
        HOURDEN_PUBLIC_URL: "https://hourden.com",
        HOURDEN_BASE_URL: "https://legacy.example.com",
      }),
    ).toBe("https://hourden.com");
  });

  it("falls back to HOURDEN_BASE_URL when PUBLIC_URL is unset", () => {
    expect(
      resolvePublicUrl({
        HOURDEN_BASE_URL: "https://hourden.hannesduve.com",
      }),
    ).toBe("https://hourden.hannesduve.com");
  });

  it("defaults to the canonical apex URL", () => {
    expect(resolvePublicUrl({})).toBe("https://hourden.com");
  });
});
