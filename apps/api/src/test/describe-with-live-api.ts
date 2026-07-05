import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import {
  withAuthenticatedWorkspace,
  type ApiIntegrationWorkspace,
  type WebIntegrationWorkspace,
} from "./integration-fixture.js";
import { resetWorkspace } from "./reset-workspace.js";

const databaseUrl = process.env.DATABASE_URL;

type DescribeOptions = { timeout?: number };

export function describeWithAuthenticatedWorkspace(
  name: string,
  fn: (ctx: () => ApiIntegrationWorkspace) => void,
  options?: DescribeOptions,
): void {
  describe.skipIf(!databaseUrl)(name, options ?? {}, () => {
    let workspace: ApiIntegrationWorkspace;

    beforeAll(async () => {
      workspace = await withAuthenticatedWorkspace("api", databaseUrl);
    });

    beforeEach(async () => {
      await resetWorkspace(workspace.pool, DEFAULT_WORKSPACE_ID);
    });

    afterAll(async () => {
      await workspace.teardown();
    });

    fn(() => workspace);
  });
}

export function describeWithAuthenticatedWebWorkspace(
  name: string,
  fn: (ctx: () => WebIntegrationWorkspace) => void,
  options?: DescribeOptions,
): void {
  describe.skipIf(!databaseUrl)(name, options ?? {}, () => {
    let workspace: WebIntegrationWorkspace;

    beforeAll(async () => {
      workspace = await withAuthenticatedWorkspace("web", databaseUrl);
    });

    beforeEach(async () => {
      await resetWorkspace(workspace.pool, DEFAULT_WORKSPACE_ID);
    });

    afterAll(async () => {
      await workspace.teardown();
    });

    fn(() => workspace);
  });
}

export { resetWorkspace } from "./reset-workspace.js";
