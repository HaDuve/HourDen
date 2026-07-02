import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { MIGRATIONS } from "./migrations.js";

describe("migration definitions", () => {
  it("seeds the default MVP workspace", () => {
    const workspacesMigration = MIGRATIONS.find((m) => m.id === "001_workspaces");
    expect(workspacesMigration).toBeDefined();
    expect(workspacesMigration?.sql).toContain(DEFAULT_WORKSPACE_ID);
  });
});
