export const WORKSPACE_EVENTS = ["timer-changed", "today-changed"] as const;
export type WorkspaceEvent = (typeof WORKSPACE_EVENTS)[number];

type Subscriber = (event: WorkspaceEvent) => void;

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
    onEvent(event);
  }
}
