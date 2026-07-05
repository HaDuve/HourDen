import { describe, expect, it } from "vitest";
import { groupTrackerEntriesByMonth } from "./tracker-entries.js";

function entry(
  id: string,
  startedAt: string,
  durationMinutes: number,
) {
  return { id, startedAt, durationMinutes };
}

describe("groupTrackerEntriesByMonth", () => {
  it("groups entries by month and day with newest first", () => {
    const groups = groupTrackerEntriesByMonth(
      [
        entry("1", "2026-07-02T10:00:00.000Z", 60),
        entry("2", "2026-07-01T10:00:00.000Z", 30),
        entry("3", "2026-06-25T09:00:00.000Z", 45),
      ],
      { timeZone: "UTC", today: "2026-07-02" },
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]!.monthLabel).toBe("This month");
    expect(groups[0]!.days).toHaveLength(2);
    expect(groups[0]!.days[0]!.date).toBe("2026-07-02");
    expect(groups[0]!.days[0]!.entries.map((e) => e.id)).toEqual(["1"]);
    expect(groups[0]!.days[1]!.date).toBe("2026-07-01");
    expect(groups[1]!.monthLabel).toBe("Last month");
    expect(groups[1]!.days[0]!.date).toBe("2026-06-25");
  });

  it("labels older months with month and year", () => {
    const groups = groupTrackerEntriesByMonth(
      [entry("1", "2026-05-10T10:00:00.000Z", 60)],
      { timeZone: "UTC", today: "2026-07-02" },
    );

    expect(groups[0]!.monthLabel).toBe("May 2026");
  });

  it("uses German month labels when locale is de", () => {
    const groups = groupTrackerEntriesByMonth(
      [
        entry("1", "2026-07-02T10:00:00.000Z", 60),
        entry("2", "2026-06-25T09:00:00.000Z", 45),
      ],
      { timeZone: "UTC", today: "2026-07-02", locale: "de" },
    );

    expect(groups[0]!.monthLabel).toBe("Dieser Monat");
    expect(groups[1]!.monthLabel).toBe("Letzter Monat");
  });
});
