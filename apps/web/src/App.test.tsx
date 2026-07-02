import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App.js";

describe("App", () => {
  it("shows API health status after calling the health endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/API status: ok/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/health");
  });
});
