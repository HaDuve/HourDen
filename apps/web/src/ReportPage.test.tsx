import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportPage from "./ReportPage.js";

function reportFetchMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/reports?")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ from: "2026-06-01", to: "2026-06-30", clients: [] }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe("ReportPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the date range to last month when the last month quick control is clicked", async () => {
    vi.stubGlobal("fetch", reportFetchMock());
    vi.setSystemTime(new Date(2026, 5, 18));

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-06-01");
    });

    fireEvent.click(screen.getByRole("button", { name: /^last month$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-05-01");
      expect(screen.getByLabelText(/^to$/i)).toHaveValue("2026-05-31");
    });
  });
});
