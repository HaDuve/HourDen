import {
  WORKSPACE_EVENTS,
  type WorkspaceEvent,
} from "@hourden/domain";

export { WORKSPACE_EVENTS, type WorkspaceEvent };

type Subscriber = (event: WorkspaceEvent) => void | Promise<void>;

const subscribersByWorkspace = new Map<string, Set<Subscriber>>();

// Single-process fan-out only (ADR-0010). For multiple API replicas, replace
// with Postgres LISTEN/NOTIFY or Redis pub/sub without changing the SSE contract.

function getSubscribers(workspaceId: string): Set<Subscriber> {
  let subscribers = subscribersByWorkspace.get(workspaceId);
  if (!subscribers) {
    subscribers = new Set();
    subscribersByWorkspace.set(workspaceId, subscribers);
  }
  return subscribers;
}

function notifySubscriber(onEvent: Subscriber, event: WorkspaceEvent): void {
  try {
    const result = onEvent(event);
    if (result instanceof Promise) {
      void result.catch(() => {});
    }
  } catch {
    // Keep fan-out going when one subscriber fails.
  }
}

export function subscribe(
  workspaceId: string,
  onEvent: Subscriber,
): () => void {
  const subscribers = getSubscribers(workspaceId);
  subscribers.add(onEvent);

  return () => {
    subscribers.delete(onEvent);
    if (subscribers.size === 0) {
      subscribersByWorkspace.delete(workspaceId);
    }
  };
}

export function publishWorkspaceEvent(
  workspaceId: string,
  event: WorkspaceEvent,
): void {
  const subscribers = subscribersByWorkspace.get(workspaceId);
  if (!subscribers) {
    return;
  }

  for (const onEvent of subscribers) {
    notifySubscriber(onEvent, event);
  }
}
