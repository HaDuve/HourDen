export const WORKSPACE_EVENTS = ["timer-changed", "today-changed"] as const;
export type WorkspaceEvent = (typeof WORKSPACE_EVENTS)[number];
