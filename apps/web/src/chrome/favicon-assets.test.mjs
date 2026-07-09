import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readPngInfoFromFile } from "../../scripts/favicon-png.mjs";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../../public");

const FAVICON_ASSETS = [
  { file: "favicon-source.png", width: 1024, height: 1024 },
  { file: "favicon-32x32.png", width: 32, height: 32 },
  { file: "apple-touch-icon.png", width: 180, height: 180 },
];

describe("favicon PNG assets", () => {
  for (const { file, width, height } of FAVICON_ASSETS) {
    it(`${file} is RGBA PNG without a bKGD chunk`, () => {
      const info = readPngInfoFromFile(join(publicDir, file));

      expect(info.colorType).toBe(6);
      expect(info.chunks).not.toContain("bKGD");
      expect(info.width).toBe(width);
      expect(info.height).toBe(height);
    });
  }
});
