import { describe, expect, it } from "vitest";
import { publishWorkspaceEvent, subscribe } from "./workspace-bus.js";

describe("workspace bus", () => {
  it("delivers an event only to subscribers in the same workspace", () => {
    const wsAEvents: string[] = [];
    const wsBEvents: string[] = [];

    const unsubA = subscribe("workspace-a", (event) => wsAEvents.push(event));
    const unsubB = subscribe("workspace-b", (event) => wsBEvents.push(event));

    publishWorkspaceEvent("workspace-a", "timer-changed");

    expect(wsAEvents).toEqual(["timer-changed"]);
    expect(wsBEvents).toEqual([]);

    unsubA();
    unsubB();
  });
});
