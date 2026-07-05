import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as migrateForTests from "./migrate-for-tests.js";
import {
  prepareIntegrationDatabase,
  resetPrepareIntegrationDatabaseForTests,
} from "./prepare-integration-database.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("prepareIntegrationDatabase process guard", () => {
  beforeEach(() => {
    resetPrepareIntegrationDatabaseForTests();
  });

  afterEach(() => {
    resetPrepareIntegrationDatabaseForTests();
    vi.restoreAllMocks();
  });

  it("runs runMigrationsForTests only once per process", async () => {
    const spy = vi
      .spyOn(migrateForTests, "runMigrationsForTests")
      .mockResolvedValue(undefined);

    await prepareIntegrationDatabase();
    await prepareIntegrationDatabase();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
