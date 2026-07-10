import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MIN_TAB_FAVICON_BOUNDS_FILL,
  TAB_FAVICON_CROP_HEIGHT_PERCENT,
  readOpaqueBoundsFillFromFile,
  readPngInfoFromFile,
} from "./favicon-png.mjs";

const publicDir = join(import.meta.dirname, "..", "public");

describe("favicon-png", () => {
  it("tab crop percent omits the wordmark band while keeping shield + clock", () => {
    expect(TAB_FAVICON_CROP_HEIGHT_PERCENT).toBeGreaterThanOrEqual(75);
    expect(TAB_FAVICON_CROP_HEIGHT_PERCENT).toBeLessThan(100);
  });

  it("favicon-32x32.png fills most of the canvas after trim and crop", () => {
    const { width, height, colorType, chunks } = readPngInfoFromFile(
      join(publicDir, "favicon-32x32.png"),
    );
    expect(width).toBe(32);
    expect(height).toBe(32);
    expect(colorType).toBe(6);
    expect(chunks).not.toContain("bKGD");

    const boundsFill = readOpaqueBoundsFillFromFile(join(publicDir, "favicon-32x32.png"));
    expect(boundsFill).toBeGreaterThanOrEqual(MIN_TAB_FAVICON_BOUNDS_FILL);
  });
});
