import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";

/** Single choke-point for workspace resolution (ADR-0004). */
export function getCurrentWorkspaceId(): string {
  return DEFAULT_WORKSPACE_ID;
}
