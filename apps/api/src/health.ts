import { getCurrentWorkspaceId } from "./workspace.js";

export function healthPayload() {
  return {
    status: "ok" as const,
    workspaceId: getCurrentWorkspaceId(),
  };
}
