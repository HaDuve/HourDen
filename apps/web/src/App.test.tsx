import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App.js";

describe("App", () => {
  it("shows API health status after calling the health endpoint", async () => {
    const fetchMock =     vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", workspaceId: "a0000000-0000-4000-8000-000000000001" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/API status: ok/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/health");
  });
});
