import { publishWorkspaceEvent } from "./workspace-bus.js";

export function notifyRunningTimerChanged(workspaceId: string): void {
  publishWorkspaceEvent(workspaceId, "timer-changed");
}

export function notifyTrackerEntriesChanged(workspaceId: string): void {
  publishWorkspaceEvent(workspaceId, "today-changed");
}

export function notifyTimerMutation(workspaceId: string): void {
  notifyRunningTimerChanged(workspaceId);
  notifyTrackerEntriesChanged(workspaceId);
}
