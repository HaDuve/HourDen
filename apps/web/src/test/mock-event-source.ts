type Listener = (event: MessageEvent) => void;

export class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  withCredentials: boolean;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();
  closed = false;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  close() {
    this.closed = true;
  }

  emit(type: string) {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }
    const event = new MessageEvent(type, { data: "" });
    for (const listener of listeners) {
      listener(event);
    }
  }

  triggerError() {
    this.onerror?.();
  }
}

export function installMockEventSource(): void {
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
}

export function resetMockEventSources(): void {
  for (const source of MockEventSource.instances) {
    source.close();
  }
  MockEventSource.instances = [];
}
