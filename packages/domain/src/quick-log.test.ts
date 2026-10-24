import { describe, expect, it } from "vitest";
import {
  parseQuickLog,
  type QuickLogParseContext,
  type QuickLogProjectCandidate,
} from "./quick-log.js";

const ondojo: QuickLogProjectCandidate = {
  id: "proj-ondojo",
  name: "Ondojo",
  clientId: "client-bandao",
  clientName: "BANDAO",
  defaultRate: 100,
};

const coaching: QuickLogProjectCandidate = {
  id: "proj-coaching",
  name: "Coaching",
  clientId: "client-hannah",
  clientName: "HANNAH",
  defaultRate: 80,
};

const ondojoApi: QuickLogProjectCandidate = {
  id: "proj-ondojo-api",
  name: "Ondojo API",
  clientId: "client-bandao",
  clientName: "BANDAO",
  defaultRate: 100,
};

const baseContext: QuickLogParseContext = {
  projects: [ondojo, coaching],
  now: new Date("2026-10-24T15:30:00.000Z"),
  timeZone: "UTC",
};

describe("parseQuickLog", () => {
  it.each([
    {
      name: "duration + project + description + yesterday",
      input: "2h ondojo api refactor yesterday",
      expected: {
        kind: "manual" as const,
        startedAt: "2026-10-23T13:30:00.000Z",
        endedAt: "2026-10-23T15:30:00.000Z",
        durationMinutes: 120,
        projectId: "proj-ondojo",
        projectName: "Ondojo",
        clientName: "BANDAO",
        description: "api refactor",
        amountPreview: 200,
        dateKey: "2026-10-23",
        commitable: true,
      },
    },
    {
      name: "explicit time range today",
      input: "9:00-11:30 coaching weekly call",
      expected: {
        kind: "manual" as const,
        startedAt: "2026-10-24T09:00:00.000Z",
        endedAt: "2026-10-24T11:30:00.000Z",
        durationMinutes: 150,
        projectId: "proj-coaching",
        projectName: "Coaching",
        clientName: "HANNAH",
        description: "weekly call",
        amountPreview: 200,
        dateKey: "2026-10-24",
        commitable: true,
      },
    },
    {
      name: "start running timer",
      input: "start ondojo code review",
      expected: {
        kind: "start" as const,
        projectId: "proj-ondojo",
        projectName: "Ondojo",
        clientName: "BANDAO",
        description: "code review",
        commitable: true,
      },
    },
    {
      name: "stop running timer",
      input: "stop",
      expected: {
        kind: "stop" as const,
        commitable: true,
      },
    },
  ])("four core examples: $name", ({ input, expected }) => {
    expect(parseQuickLog(input, baseContext)).toEqual(expected);
  });

  it.each([
    {
      name: "German duration + gestern",
      input: "2std ondojo api refactor gestern",
      expectedStartedAt: "2026-10-23T13:30:00.000Z",
      expectedEndedAt: "2026-10-23T15:30:00.000Z",
      expectedDateKey: "2026-10-23",
    },
    {
      name: "German heute + time range",
      input: "heute 9:00-11:30 coaching weekly call",
      expectedStartedAt: "2026-10-24T09:00:00.000Z",
      expectedEndedAt: "2026-10-24T11:30:00.000Z",
      expectedDateKey: "2026-10-24",
    },
    {
      name: "Stunden keyword",
      input: "2 stunden ondojo api refactor heute",
      expectedStartedAt: "2026-10-24T13:30:00.000Z",
      expectedEndedAt: "2026-10-24T15:30:00.000Z",
      expectedDateKey: "2026-10-24",
    },
  ])("German keywords: $name", ({ input, expectedStartedAt, expectedEndedAt, expectedDateKey }) => {
    const result = parseQuickLog(input, baseContext);
    expect(result).toMatchObject({
      kind: "manual",
      startedAt: expectedStartedAt,
      endedAt: expectedEndedAt,
      dateKey: expectedDateKey,
      projectId: expect.any(String),
      commitable: true,
    });
  });

  it("parses go-to navigation commands", () => {
    expect(parseQuickLog("Go to Invoices", baseContext)).toEqual({
      kind: "navigate",
      destination: "invoices",
      commitable: true,
    });
    expect(parseQuickLog("go to dashboard", baseContext)).toEqual({
      kind: "navigate",
      destination: "dashboard",
      commitable: true,
    });
    expect(parseQuickLog("gehe zu tracker", baseContext)).toEqual({
      kind: "navigate",
      destination: "tracker",
      commitable: true,
    });
  });

  it("returns ambiguous project candidates for arrow pick list", () => {
    const result = parseQuickLog("1h ondojo work", {
      ...baseContext,
      projects: [ondojo, ondojoApi, coaching],
    });
    expect(result).toMatchObject({
      kind: "manual",
      commitable: false,
      description: "work",
    });
    if (result.kind !== "manual") throw new Error("expected manual");
    expect(result.candidates?.map((c) => c.id).sort()).toEqual(
      ["proj-ondojo", "proj-ondojo-api"].sort(),
    );
  });

  it("resolves ambiguous project when selectedProjectId is provided", () => {
    const result = parseQuickLog("1h ondojo work", {
      ...baseContext,
      projects: [ondojo, ondojoApi, coaching],
      selectedProjectId: "proj-ondojo-api",
    });
    expect(result).toMatchObject({
      kind: "manual",
      projectId: "proj-ondojo-api",
      projectName: "Ondojo API",
      commitable: true,
    });
  });

  it("reports what is missing for unparseable input", () => {
    expect(parseQuickLog("api refactor", baseContext)).toEqual({
      kind: "incomplete",
      missing: ["duration_or_range"],
      commitable: false,
    });
    expect(parseQuickLog("2h", baseContext)).toEqual({
      kind: "incomplete",
      missing: ["description"],
      commitable: false,
    });
    expect(parseQuickLog("", baseContext)).toEqual({
      kind: "empty",
      commitable: false,
    });
  });

  it("matches project via client name", () => {
    const result = parseQuickLog("1h bandao planning", baseContext);
    expect(result).toMatchObject({
      kind: "manual",
      projectId: "proj-ondojo",
      clientName: "BANDAO",
      description: "planning",
      commitable: true,
    });
  });

  it("parses minutes duration", () => {
    const result = parseQuickLog("45m coaching standup", baseContext);
    expect(result).toMatchObject({
      kind: "manual",
      durationMinutes: 45,
      startedAt: "2026-10-24T14:45:00.000Z",
      endedAt: "2026-10-24T15:30:00.000Z",
      projectId: "proj-coaching",
      description: "standup",
    });
  });

  it("parses German stop keyword", () => {
    expect(parseQuickLog("stopp", baseContext)).toEqual({
      kind: "stop",
      commitable: true,
    });
  });

  it("parses German start keyword", () => {
    expect(parseQuickLog("starten ondojo review", baseContext)).toMatchObject({
      kind: "start",
      projectId: "proj-ondojo",
      description: "review",
      commitable: true,
    });
  });
});
