import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readPngInfoFromFile } from "../../scripts/favicon-png.mjs";

const webRoot = fileURLToPath(new URL("../..", import.meta.url));
const publicDir = join(webRoot, "public");

const FAVICON_ASSETS = ["favicon-source.png", "favicon-32x32.png", "apple-touch-icon.png"];

describe("favicon PNG assets", () => {
  for (const file of FAVICON_ASSETS) {
    it(`${file} is RGBA PNG without a bKGD chunk`, () => {
      const { chunks, colorType } = readPngInfoFromFile(join(publicDir, file));

      expect(colorType).toBe(6);
      expect(chunks).not.toContain("bKGD");
    });
  }
});
