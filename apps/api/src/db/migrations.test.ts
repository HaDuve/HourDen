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

  it("adds import fingerprints for idempotent Clockify imports", () => {
    const migration = MIGRATIONS.find((m) => m.id === "005_clockify_import_fingerprint");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("import_fingerprint");
    expect(migration?.sql).toContain("workspace_id, import_fingerprint");
  });

  it("creates the invoices table and links invoiced time entries", () => {
    const migration = MIGRATIONS.find((m) => m.id === "006_invoices");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("CREATE TABLE IF NOT EXISTS invoices");
    expect(migration?.sql).toContain("UNIQUE (client_id, period_start, period_end)");
    expect(migration?.sql).toContain("time_entries_invoice_id_fkey");
  });

  it("enforces unique invoice numbers per Client", () => {
    const migration = MIGRATIONS.find((m) => m.id === "007_invoice_number_unique");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("invoices_client_invoice_number_unique_idx");
  });

  it("adds issuance snapshot and status columns to invoices", () => {
    const migration = MIGRATIONS.find((m) => m.id === "008_invoice_snapshot");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("snapshot jsonb");
    expect(migration?.sql).toContain("status text");
    expect(migration?.sql).toContain("DEFAULT 'issued'");
  });

  it("stores per-client invoice numbering strategy by year", () => {
    const migration = MIGRATIONS.find((m) => m.id === "009_client_invoice_numbering");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("client_invoice_numbering");
    expect(migration?.sql).toContain("strategy text");
    expect(migration?.sql).toContain("'sequential', 'from_last'");
  });

  it("adds invoice_prefix and enforces workspace-wide invoice number uniqueness", () => {
    const migration = MIGRATIONS.find(
      (m) => m.id === "010_workspace_invoice_numbering",
    );
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("invoice_prefix");
    expect(migration?.sql).toContain(
      "invoices_workspace_invoice_number_unique_idx",
    );
    expect(migration?.sql).toContain(
      "DROP INDEX IF EXISTS invoices_client_invoice_number_unique_idx",
    );
    expect(migration?.preCheck).toBeTypeOf("function");
  });

  it("stores workspace-wide plain invoice numbering strategy by year", () => {
    const migration = MIGRATIONS.find(
      (m) => m.id === "011_workspace_invoice_numbering_strategy",
    );
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("workspace_invoice_numbering");
    expect(migration?.sql).toContain("strategy text");
    expect(migration?.sql).toContain("'sequential', 'from_last'");
  });

  it("adds auth tables, workspace sender settings, and operator seeding", () => {
    const migration = MIGRATIONS.find((m) => m.id === "012_auth");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(migration?.sql).toContain("CREATE TABLE IF NOT EXISTS sessions");
    expect(migration?.sql).toContain("workspace_memberships");
    expect(migration?.sql).toContain("sender_name");
    expect(migration?.sql).toContain("calendar_timezone");
    expect(migration?.apply).toBeTypeOf("function");
  });

  it("adds a nullable locale column on users for Language preference", () => {
    const migration = MIGRATIONS.find((m) => m.id === "013_user_locale");
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain("locale");
    expect(migration?.sql).toContain("users");
    expect(migration?.sql).toMatch(/CHECK.*en.*de/s);
  });
});
