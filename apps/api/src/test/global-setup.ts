import type { TestProject } from "vitest/node";
import "../load-env.js";
import {
  TEST_OPERATOR_EMAIL,
  TEST_OPERATOR_PASSWORD,
} from "./operator-credentials.js";
import { prepareIntegrationDatabase } from "./prepare-integration-database.js";

async function seedIntegrationDatabase(): Promise<void> {
  process.env.HOURDEN_OPERATOR_EMAIL ??= TEST_OPERATOR_EMAIL;
  process.env.HOURDEN_OPERATOR_PASSWORD ??= TEST_OPERATOR_PASSWORD;
  await prepareIntegrationDatabase();
}

export default async function setup(project: TestProject) {
  await seedIntegrationDatabase();

  project.onTestsRerun(async () => {
    await seedIntegrationDatabase();
  });
}
