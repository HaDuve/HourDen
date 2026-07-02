import { describe, expect, it } from "vitest";
import { healthPayload } from "./health.js";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";

describe("healthPayload", () => {
  it("reports ok status and the current workspace id", () => {
    expect(healthPayload()).toEqual({
      status: "ok",
      workspaceId: DEFAULT_WORKSPACE_ID,
    });
  });
});
