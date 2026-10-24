import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_COLOR } from "./project-default-color.js";

describe("DEFAULT_PROJECT_COLOR", () => {
  it("is not the ember brand hue so new Projects never look live", () => {
    expect(DEFAULT_PROJECT_COLOR.toLowerCase()).not.toBe("#f59e0b");
    expect(DEFAULT_PROJECT_COLOR.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
  });
});
