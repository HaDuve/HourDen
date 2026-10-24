import { describe, expect, it } from "vitest";
import { buildStackedDailyChart } from "./stacked-daily-chart.js";

describe("buildStackedDailyChart", () => {
  it("pivots project segments into stacked rows and a legend series", () => {
    const { rows, series } = buildStackedDailyChart(
      [
        {
          date: "2026-06-18",
          durationMinutes: 74,
          byProject: [
            {
              projectId: "p-ondojo",
              projectName: "Ondojo",
              color: "#3b82f6",
              durationMinutes: 74,
            },
          ],
        },
        {
          date: "2026-06-19",
          durationMinutes: 90,
          byProject: [
            {
              projectId: "p-website",
              projectName: "Website",
              color: "#34d399",
              durationMinutes: 60,
            },
            {
              projectId: "p-ondojo",
              projectName: "Ondojo",
              color: "#3b82f6",
              durationMinutes: 30,
            },
          ],
        },
      ],
      (date) => date,
      "Unassigned",
      "#3b82f6",
    );

    expect(series).toEqual([
      { key: "p-ondojo", name: "Ondojo", color: "#3b82f6" },
      { key: "p-website", name: "Website", color: "#34d399" },
    ]);
    expect(rows).toEqual([
      {
        date: "2026-06-18",
        label: "2026-06-18",
        "p-ondojo": 74,
        "p-website": 0,
      },
      {
        date: "2026-06-19",
        label: "2026-06-19",
        "p-ondojo": 30,
        "p-website": 60,
      },
    ]);
  });

  it("uses the unassigned key and fallback color when project is missing", () => {
    const { series, rows } = buildStackedDailyChart(
      [
        {
          date: "2026-06-20",
          durationMinutes: 15,
          byProject: [
            {
              projectId: null,
              projectName: null,
              color: null,
              durationMinutes: 15,
            },
          ],
        },
      ],
      (date) => date,
      "Unassigned",
      "#3b82f6",
    );

    expect(series).toEqual([
      { key: "__unassigned__", name: "Unassigned", color: "#3b82f6" },
    ]);
    expect(rows[0]).toMatchObject({ __unassigned__: 15 });
  });
});
