import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import i18n from "../i18n/i18n.js";
import { appRoutes } from "../routes.js";

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("legal pages", () => {
  it("serves /terms without requiring authentication", () => {
    renderRoute("/terms");

    expect(screen.getByRole("heading", { level: 1, name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByText(/placeholder/i)).toBeInTheDocument();
  });

  it("serves /privacy without requiring authentication", () => {
    renderRoute("/privacy");

    expect(screen.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /bot prevention \(cloudflare turnstile\)/i }),
    ).toBeInTheDocument();
  });

  it("localizes legal pages in German", async () => {
    await i18n.changeLanguage("de");
    renderRoute("/privacy");

    expect(screen.getByRole("heading", { level: 1, name: /datenschutzerklärung/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /bot-schutz \(cloudflare turnstile\)/i }),
    ).toBeInTheDocument();
  });
});
