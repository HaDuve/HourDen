import { describe, expect, it } from "vitest";
import { groupTrackerEntriesByWeek } from "./tracker-entries.js";

function entry(
  id: string,
  startedAt: string,
  durationMinutes: number,
) {
  return { id, startedAt, durationMinutes };
}

describe("groupTrackerEntriesByWeek", () => {
  it("groups entries by week and day with newest first", () => {
    const groups = groupTrackerEntriesByWeek(
      [
        entry("1", "2026-07-02T10:00:00.000Z", 60),
        entry("2", "2026-07-01T10:00:00.000Z", 30),
        entry("3", "2026-06-25T09:00:00.000Z", 45),
      ],
      { timeZone: "UTC", today: "2026-07-02" },
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]!.weekLabel).toBe("This week");
    expect(groups[0]!.days).toHaveLength(2);
    expect(groups[0]!.days[0]!.date).toBe("2026-07-02");
    expect(groups[0]!.days[0]!.entries.map((e) => e.id)).toEqual(["1"]);
    expect(groups[0]!.days[1]!.date).toBe("2026-07-01");
    expect(groups[1]!.weekLabel).toBe("Last week");
    expect(groups[1]!.days[0]!.date).toBe("2026-06-25");
  });

  it("labels older weeks with a date range", () => {
    const groups = groupTrackerEntriesByWeek(
      [entry("1", "2026-06-10T10:00:00.000Z", 60)],
      { timeZone: "UTC", today: "2026-07-02" },
    );

    expect(groups[0]!.weekLabel).toBe("Jun 8 - Jun 14");
  });
});
