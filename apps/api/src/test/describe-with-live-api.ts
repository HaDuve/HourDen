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

function describeWithAuthenticatedWorkspaceForSurface(
  surface: "api" | "web",
  name: string,
  fn: (ctx: () => ApiIntegrationWorkspace | WebIntegrationWorkspace) => void,
  options?: DescribeOptions,
): void {
  describe.skipIf(!databaseUrl)(name, options ?? {}, () => {
    let workspace: ApiIntegrationWorkspace | WebIntegrationWorkspace;

    beforeAll(async () => {
      workspace = await withAuthenticatedWorkspace(surface, databaseUrl);
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

export function describeWithAuthenticatedWorkspace(
  name: string,
  fn: (ctx: () => ApiIntegrationWorkspace) => void,
  options?: DescribeOptions,
): void {
  describeWithAuthenticatedWorkspaceForSurface("api", name, fn, options);
}

export function describeWithAuthenticatedWebWorkspace(
  name: string,
  fn: (ctx: () => WebIntegrationWorkspace) => void,
  options?: DescribeOptions,
): void {
  describeWithAuthenticatedWorkspaceForSurface("web", name, fn, options);
}

export { resetWorkspace } from "./reset-workspace.js";
