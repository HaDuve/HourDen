import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe } from "vitest";
import {
  withAuthenticatedWorkspace,
  withFreshUserWorkspace,
  type FreshUserIntegrationWorkspace,
  type WebIntegrationWorkspace,
} from "../../../api/src/test/integration-fixture.js";
import { resetWorkspace } from "../../../api/src/test/reset-workspace.js";
import type { CreateUserWithWorkspaceInput } from "../../../api/src/db/workspaces.js";
import { resetMockEventSources } from "./mock-event-source.js";

const databaseUrl = process.env.DATABASE_URL;

type DescribeOptions = { timeout?: number };

export function describeWithAuthenticatedWorkspace(
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

    afterEach(async () => {
      cleanup();
      resetMockEventSources();
      await workspace.flushAsync();
    });

    afterAll(async () => {
      await workspace.teardown();
    });

    fn(() => workspace);
  });
}

export function describeWithFreshUserWorkspace(
  name: string,
  input: CreateUserWithWorkspaceInput,
  fn: (ctx: () => FreshUserIntegrationWorkspace) => void,
  options?: DescribeOptions,
): void {
  describe.skipIf(!databaseUrl)(name, options ?? {}, () => {
    let workspace: FreshUserIntegrationWorkspace;

    beforeAll(async () => {
      workspace = await withFreshUserWorkspace("web", input, databaseUrl);
    });

    beforeEach(async () => {
      await resetWorkspace(workspace.pool, workspace.workspaceId);
    });

    afterEach(async () => {
      cleanup();
      resetMockEventSources();
      await workspace.flushAsync();
    });

    afterAll(async () => {
      await workspace.teardown();
    });

    fn(() => workspace);
  });
}
