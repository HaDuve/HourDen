import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";

const workspaceStore = new AsyncLocalStorage<string>();

export function runWithWorkspaceId<T>(
  workspaceId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(workspaceStore.run(workspaceId, fn));
}

/** Single choke-point for workspace resolution (ADR-0004). */
export function getCurrentWorkspaceId(): string {
  return workspaceStore.getStore() ?? DEFAULT_WORKSPACE_ID;
}
