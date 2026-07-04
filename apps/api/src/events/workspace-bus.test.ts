import { describe, expect, it } from "vitest";
import { publishWorkspaceEvent, subscribe } from "./workspace-bus.js";

describe("workspace bus", () => {
  it("delivers an event only to subscribers in the same workspace", () => {
    const wsAEvents: string[] = [];
    const wsBEvents: string[] = [];

    const unsubA = subscribe("workspace-a", (event) => {
      wsAEvents.push(event);
    });
    const unsubB = subscribe("workspace-b", (event) => {
      wsBEvents.push(event);
    });

    publishWorkspaceEvent("workspace-a", "timer-changed");

    expect(wsAEvents).toEqual(["timer-changed"]);
    expect(wsBEvents).toEqual([]);

    unsubA();
    unsubB();
  });

  it("keeps notifying other subscribers when one subscriber fails", () => {
    const received: string[] = [];

    subscribe("workspace-a", () => {
      throw new Error("subscriber failed");
    });
    const unsub = subscribe("workspace-a", (event) => {
      received.push(event);
    });

    publishWorkspaceEvent("workspace-a", "today-changed");

    expect(received).toEqual(["today-changed"]);
    unsub();
  });

  it("keeps notifying other subscribers when one async subscriber rejects", async () => {
    const received: string[] = [];

    subscribe("workspace-a", () => Promise.reject(new Error("async failed")));
    const unsub = subscribe("workspace-a", (event) => {
      received.push(event);
    });

    publishWorkspaceEvent("workspace-a", "timer-changed");
    await Promise.resolve();

    expect(received).toEqual(["timer-changed"]);
    unsub();
  });
});
