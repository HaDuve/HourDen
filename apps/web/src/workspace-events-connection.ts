import { WORKSPACE_EVENTS, type WorkspaceEvent } from "@hourden/domain";

export type WorkspaceEventHandlers = Partial<Record<WorkspaceEvent, () => void>>;

const EVENTS_URL = "/api/events";
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

type SessionStatus = "valid" | "expired" | "unavailable";

const handlerSets = new Set<WorkspaceEventHandlers>();
let source: EventSource | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

async function checkSession(): Promise<SessionStatus> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.status === 200) {
      return "valid";
    }
    if (res.status === 401) {
      return "expired";
    }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

function redirectToLogin(): void {
  try {
    window.location.replace("/login");
  } catch {
    // jsdom does not implement full navigation.
  }
}

function dispatchEvent(eventName: WorkspaceEvent): void {
  for (const handlers of handlerSets) {
    handlers[eventName]?.();
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== undefined) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function closeSource(): void {
  source?.close();
  source = null;
}

function scheduleReconnect(): void {
  if (disposed || handlerSets.size === 0) {
    return;
  }

  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void connect();
  }, delay);
}

async function connect(): Promise<void> {
  if (disposed || handlerSets.size === 0) {
    return;
  }

  clearReconnectTimer();
  closeSource();

  const session = await checkSession();
  if (session === "expired") {
    redirectToLogin();
    return;
  }
  if (session === "unavailable") {
    scheduleReconnect();
    return;
  }

  if (disposed || handlerSets.size === 0) {
    return;
  }

  source = new EventSource(EVENTS_URL, { withCredentials: true });
  reconnectAttempt = 0;

  for (const eventName of WORKSPACE_EVENTS) {
    source.addEventListener(eventName, () => {
      dispatchEvent(eventName);
    });
  }

  source.onerror = () => {
    closeSource();
    void (async () => {
      const session = await checkSession();
      if (session === "expired") {
        redirectToLogin();
        return;
      }
      scheduleReconnect();
    })();
  };
}

export function subscribeWorkspaceEvents(handlers: WorkspaceEventHandlers): () => void {
  handlerSets.add(handlers);
  if (handlerSets.size === 1) {
    disposed = false;
    void connect();
  }

  return () => {
    handlerSets.delete(handlers);
    if (handlerSets.size === 0) {
      disposed = true;
      clearReconnectTimer();
      closeSource();
    }
  };
}

export function resetWorkspaceEventsConnectionForTests(): void {
  disposed = true;
  handlerSets.clear();
  clearReconnectTimer();
  closeSource();
  reconnectAttempt = 0;
}
