import { describe, expect, it } from "vitest";
import {
  applyLocalDate,
  applyScheduleFieldsChange,
  localDateAndTimeToIso,
  localDateValue,
  localTimeValue,
  shiftInstantByLocalDateDelta,
} from "./localDatetimeValue.js";

describe("localDatetimeValue helpers", () => {
  it("splits and recombines local date and time", () => {
    const local = new Date(2026, 6, 2, 8, 30);
    expect(localDateValue(local)).toBe("2026-07-02");
    expect(localTimeValue(local)).toBe("08:30");
    expect(localDateAndTimeToIso("2026-07-02", "08:30")).toBe(
      new Date(2026, 6, 2, 8, 30).toISOString(),
    );
  });

  it("applyLocalDate keeps clock time on a new local day", () => {
    const iso = new Date(2026, 6, 2, 22, 15).toISOString();
    expect(applyLocalDate(iso, "2026-07-05")).toBe(
      new Date(2026, 6, 5, 22, 15).toISOString(),
    );
  });

  it("shiftInstantByLocalDateDelta preserves overnight span when the start day moves", () => {
    const startedAt = new Date(2026, 6, 2, 22, 0).toISOString();
    const endedAt = new Date(2026, 6, 3, 2, 0).toISOString();

    expect(shiftInstantByLocalDateDelta(startedAt, "2026-07-02", "2026-07-05")).toBe(
      new Date(2026, 6, 5, 22, 0).toISOString(),
    );
    expect(shiftInstantByLocalDateDelta(endedAt, "2026-07-02", "2026-07-05")).toBe(
      new Date(2026, 6, 6, 2, 0).toISOString(),
    );
  });

  it("applyScheduleFieldsChange keeps end’s local date when only times change", () => {
    expect(
      applyScheduleFieldsChange(
        { startedAt: "2026-07-02T22:00", endedAt: "2026-07-03T02:00" },
        { date: "2026-07-02", startTime: "21:30", endTime: "02:15" },
      ),
    ).toEqual({
      startedAt: "2026-07-02T21:30",
      endedAt: "2026-07-03T02:15",
    });
  });

  it("applyScheduleFieldsChange shifts both days by the calendar delta", () => {
    expect(
      applyScheduleFieldsChange(
        { startedAt: "2026-07-02T22:00", endedAt: "2026-07-03T02:00" },
        { date: "2026-07-05", startTime: "22:00", endTime: "02:00" },
      ),
    ).toEqual({
      startedAt: "2026-07-05T22:00",
      endedAt: "2026-07-06T02:00",
    });
  });
});
