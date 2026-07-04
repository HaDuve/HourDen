import { describe, expect, it } from "vitest";
import { WORKSPACE_EVENTS } from "./workspace-events.js";

describe("WORKSPACE_EVENTS", () => {
  it("lists the invalidation signals used by the live-update stream", () => {
    expect(WORKSPACE_EVENTS).toEqual(["timer-changed", "today-changed"]);
  });
});
