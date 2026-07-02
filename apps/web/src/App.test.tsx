import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App.js";

describe("App", () => {
  it("renders the Today page by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
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
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [] }),
        });
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
    });
  });
});
