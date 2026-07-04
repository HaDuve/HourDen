import { useEffect, useRef } from "react";
import {
  WORKSPACE_EVENTS,
  type WorkspaceEvent,
} from "@hourden/domain";

export { WORKSPACE_EVENTS, type WorkspaceEvent };

export type WorkspaceEventHandlers = Partial<
  Record<WorkspaceEvent, () => void>
>;

const EVENTS_URL = "/api/events";
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

async function isSessionValid(): Promise<boolean> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  return res.status === 200;
}

export function useWorkspaceEvents(handlers: WorkspaceEventHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    };

    const closeSource = () => {
      source?.close();
      source = null;
    };

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }

      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** reconnectAttempt,
        RECONNECT_MAX_MS,
      );
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (disposed) {
        return;
      }

      clearReconnectTimer();
      closeSource();

      const valid = await isSessionValid();
      if (!valid) {
        window.location.replace("/login");
        return;
      }

      if (disposed) {
        return;
      }

      source = new EventSource(EVENTS_URL, { withCredentials: true });
      reconnectAttempt = 0;

      for (const eventName of WORKSPACE_EVENTS) {
        source.addEventListener(eventName, () => {
          handlersRef.current[eventName]?.();
        });
      }

      source.onerror = () => {
        closeSource();
        void (async () => {
          const stillValid = await isSessionValid();
          if (!stillValid) {
            window.location.replace("/login");
            return;
          }
          scheduleReconnect();
        })();
      };
    };

    void connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      closeSource();
    };
  }, []);
}
