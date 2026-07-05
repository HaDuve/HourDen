import "./test/load-env.js";

import { render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describeWithAuthenticatedWorkspace } from "./test/describe-with-live-api.js";
import { authenticatedAppRoutes } from "./routes.js";

function renderApp() {
  const router = createMemoryRouter(authenticatedAppRoutes, { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
  return router;
}

describeWithAuthenticatedWorkspace("App with live API", () => {
  it("loads the Tracker page from the live API", async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
      expect(screen.getByText(/no time entries yet/i)).toBeInTheDocument();
    });
  });

  it("loads the Invoices page from a deep link", async () => {
    const router = createMemoryRouter(authenticatedAppRoutes, {
      initialEntries: ["/invoices"],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });
  });
});
