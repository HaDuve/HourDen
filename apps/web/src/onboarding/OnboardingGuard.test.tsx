import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { authenticatedAppRoutes } from "../routes.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OnboardingGuard", () => {
  it("shows a retry screen when onboarding status cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const router = createMemoryRouter(authenticatedAppRoutes, {
      initialEntries: ["/"],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(
        screen.getByText(/could not load workspace setup status/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^retry$/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: /today/i })).not.toBeInTheDocument();
  });
});
