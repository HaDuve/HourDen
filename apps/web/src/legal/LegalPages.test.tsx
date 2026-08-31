import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("documents Cloudflare Turnstile processing in the privacy body copy", () => {
    renderRoute("/privacy");

    expect(
      screen.getByText(/cloudflare inc\. processes limited technical signals for bot detection/i),
    ).toBeInTheDocument();
  });

  it("shows a language switcher on legal pages", () => {
    renderRoute("/terms");

    expect(screen.getByRole("radio", { name: /^en$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^de$/i })).toBeInTheDocument();
  });

  it("switches legal page language without leaving the page", async () => {
    renderRoute("/privacy");

    fireEvent.click(screen.getByRole("radio", { name: /^de$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /datenschutzerklärung/i })).toBeInTheDocument();
    });
    expect(
      screen.getByText(/cloudflare inc\. verarbeitet begrenzte technische signale zur bot-erkennung/i),
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
