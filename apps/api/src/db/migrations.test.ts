import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { MIGRATIONS } from "./migrations.js";

describe("migration definitions", () => {
  it("seeds the default MVP workspace", () => {
    const workspacesMigration = MIGRATIONS.find((m) => m.id === "001_workspaces");
    expect(workspacesMigration).toBeDefined();
    expect(workspacesMigration?.sql).toContain(DEFAULT_WORKSPACE_ID);
  });

  it("creates the clients table with workspace scope and recipient fields", () => {
    const clientsMigration = MIGRATIONS.find((m) => m.id === "002_clients");
    expect(clientsMigration).toBeDefined();
    expect(clientsMigration?.sql).toContain("workspace_id");
    expect(clientsMigration?.sql).toContain("default_rate");
    expect(clientsMigration?.sql).toContain("legal_name");
    expect(clientsMigration?.sql).toContain("address_line1");
    expect(clientsMigration?.sql).toContain("address_line2");
  });

  it("creates the projects table scoped to workspace and client", () => {
    const projectsMigration = MIGRATIONS.find((m) => m.id === "003_projects");
    expect(projectsMigration).toBeDefined();
    expect(projectsMigration?.sql).toContain("workspace_id");
    expect(projectsMigration?.sql).toContain("client_id");
    expect(projectsMigration?.sql).toContain("color");
    expect(projectsMigration?.sql).toContain("ON DELETE RESTRICT");
  });
});
