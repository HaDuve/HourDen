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

  it("creates the time_entries table with workspace scope and billing fields", () => {
    const migration = MIGRATIONS.find((m) => m.id === "004_time_entries");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("workspace_id");
    expect(migration?.sql).toContain("project_id");
    expect(migration?.sql).toContain("started_at");
    expect(migration?.sql).toContain("ended_at");
    expect(migration?.sql).toContain("description");
    expect(migration?.sql).toContain("tags");
    expect(migration?.sql).toContain("billable");
    expect(migration?.sql).toContain("amount");
    expect(migration?.sql).toContain("ended_at IS NULL");
  });
});
