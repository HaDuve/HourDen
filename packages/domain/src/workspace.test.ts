import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "./workspace.js";

describe("DEFAULT_WORKSPACE_ID", () => {
  it("is a stable UUID for the seeded MVP workspace", () => {
    expect(DEFAULT_WORKSPACE_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(DEFAULT_WORKSPACE_ID).toBe(
      "a0000000-0000-4000-8000-000000000001",
    );
  });
});
