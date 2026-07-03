import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App.js";

function mockAppFetch() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/time-entries/running")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entry: null }),
      });
    }
    if (url.includes("/api/time-entries?")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entries: [] }),
      });
    }
    if (url.includes("/api/projects")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ projects: [] }),
      });
    }
    if (url.includes("/api/clients")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clients: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });
}

describe("App", () => {
  it("renders the Today page by default", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
    });
  });

  it("navigates to the Invoices page", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^invoices$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });
  });
});
