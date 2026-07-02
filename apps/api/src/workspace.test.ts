import { describe, expect, it } from "vitest";
import { getCurrentWorkspaceId } from "./workspace.js";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";

describe("getCurrentWorkspaceId", () => {
  it("returns the seeded MVP workspace id", () => {
    expect(getCurrentWorkspaceId()).toBe(DEFAULT_WORKSPACE_ID);
  });
});
