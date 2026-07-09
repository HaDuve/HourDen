import { useEffect, useRef } from "react";
import {
  WORKSPACE_EVENTS,
  type WorkspaceEvent,
} from "@hourden/domain";
import { subscribeWorkspaceEvents, type WorkspaceEventHandlers } from "./workspace-events-connection.js";

export { WORKSPACE_EVENTS, type WorkspaceEvent };
export type { WorkspaceEventHandlers };

export function useWorkspaceEvents(handlers: WorkspaceEventHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return subscribeWorkspaceEvents({
      "timer-changed": () => {
        handlersRef.current["timer-changed"]?.();
      },
      "today-changed": () => {
        handlersRef.current["today-changed"]?.();
      },
    });
  }, []);
}
