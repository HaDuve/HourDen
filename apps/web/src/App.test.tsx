import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SupportedLocale } from "@hourden/domain";
import i18n from "./i18n/i18n.js";
import { createMemoryRouter, MemoryRouter, Outlet, RouterProvider, useLocation, useNavigate, useRoutes } from "react-router-dom";
import { LocaleProvider } from "./LocaleProvider.js";
import { authenticatedAppRoutes } from "./routes.js";
import { createMatchMedia } from "./test/match-media.js";

function routesWithLocale(userLocale: SupportedLocale | null = "en") {
  return [
    {
      element: (
        <LocaleProvider userLocale={userLocale}>
          <Outlet />
        </LocaleProvider>
      ),
      children: authenticatedAppRoutes,
    },
  ];
}

function AppRoutes() {
  return useRoutes(authenticatedAppRoutes);
}

function renderApp(initialPath = "/", userLocale: SupportedLocale | null = "en") {
  const router = createMemoryRouter(routesWithLocale(userLocale), {
    initialEntries: [initialPath],
  });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;
  localStorage.clear();
  void i18n.changeLanguage("en");
});

function renderAppWithMemoryRouter(initialPath = "/", userLocale: SupportedLocale | null = "en") {
  let pathname = initialPath;
  let navigate: ReturnType<typeof useNavigate> | undefined;

  function LocationObserver() {
    pathname = useLocation().pathname;
    return null;
  }

  function NavigateCapture() {
    navigate = useNavigate();
    return null;
  }

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocaleProvider userLocale={userLocale}>
        <LocationObserver />
        <NavigateCapture />
        <AppRoutes />
      </LocaleProvider>
    </MemoryRouter>,
  );

  return {
    get pathname() {
      return pathname;
    },
    goBack() {
      if (!navigate) {
        throw new Error("navigate not ready");
      }
      navigate(-1);
    },
  };
}

function mockDesktopViewport() {
  window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
}

function mockMobileViewport() {
  window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;
}

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
    if (url.includes("/api/reports")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ from: "2026-07-01", to: "2026-07-31", clients: [] }),
      });
    }
    if (url === "/api/auth/locale") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ locale: "de" }),
      });
    }
    if (url.includes("/api/clients")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clients: [] }),
      });
    }
    if (url === "/api/invoices") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ invoices: [] }),
      });
    }
    if (url === "/api/workspace/onboarding") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          needsOnboarding: false,
          completedAt: "2026-01-01T00:00:00.000Z",
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });
}

describe("App", () => {
  it("renders the Tracker page by default", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });
  });

  it("navigates to the Invoices page and updates the URL", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /^invoices$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
      expect(app.pathname).toBe("/invoices");
    });
  });

  it("renders the Invoices page from a deep link", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/invoices");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });
  });

  it("redirects legacy /today to /tracker", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/today");

    await waitFor(() => {
      expect(app.pathname).toBe("/tracker");
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });
  });

  it("redirects unknown paths to Tracker", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/unknown-page");

    await waitFor(() => {
      expect(app.pathname).toBe("/");
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });
  });

  it("shows German navigation when locale is de", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/", "de");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    const primaryNav = screen.getByRole("navigation", { name: /hauptnavigation/i });
    expect(within(primaryNav).getByRole("link", { name: /^rechnungen$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^mehr$/i }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /^kunden$/i })).toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: /sprache/i })).toBeInTheDocument();
  });

  it("switches to German from the desktop overflow menu", async () => {
    mockDesktopViewport();
    const fetchMock = mockAppFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    fireEvent.click(screen.getByRole("radio", { name: /^deutsch$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/locale",
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(screen.getByRole("link", { name: /^rechnungen$/i })).toBeInTheDocument();
    });
  });

  it("shows Tracker and Invoices as primary links on desktop", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    const primaryNav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(primaryNav).getByRole("link", { name: /^tracker$/i })).toBeInTheDocument();
    expect(within(primaryNav).getByRole("link", { name: /^invoices$/i })).toBeInTheDocument();
    expect(within(primaryNav).queryByRole("link", { name: /^clients$/i })).not.toBeInTheDocument();
  });

  it("renders desktop nav chrome with semantic token classes", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    const primaryNav = screen.getByRole("navigation", { name: /primary/i });
    expect(primaryNav).toHaveClass("bg-surface", "border-divider");
    expect(primaryNav.closest(".min-h-screen")).toHaveClass("bg-background");
  });

  it("opens the desktop overflow menu with secondary destinations", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /^clients$/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /^projects$/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /^report$/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /^import$/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /^log out$/i })).toBeInTheDocument();
  });

  it("closes the desktop overflow menu on outside click", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("heading", { name: /tracker/i }));

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("closes the desktop overflow menu on Escape", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("highlights the active primary route on desktop", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/invoices");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });

    const primaryNav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(primaryNav).getByRole("link", { name: /^invoices$/i })).toHaveAttribute("aria-current", "page");
    expect(within(primaryNav).getByRole("link", { name: /^tracker$/i })).not.toHaveAttribute("aria-current", "page");
  });

  it("logs out from the desktop overflow menu", async () => {
    mockDesktopViewport();
    const fetchMock = mockAppFetch();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/" },
      writable: true,
    });

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^log out$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST", credentials: "include" }),
      );
    });
  });

  it("navigates to Clients from the desktop overflow menu", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^clients$/i }));

    await waitFor(() => {
      expect(app.pathname).toBe("/clients");
      expect(screen.getByRole("heading", { name: /^clients$/i })).toBeInTheDocument();
    });
  });

  it("shows a mobile bottom tab bar with Tracker, Invoices, and More", async () => {
    mockMobileViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
    expect(within(mobileNav).getByRole("link", { name: /^tracker$/i })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: /^invoices$/i })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("button", { name: /^more$/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /primary/i })).not.toBeInTheDocument();
    expect(mobileNav).toHaveClass("bg-surface", "border-divider");
  });

  it("opens the mobile More sheet with secondary destinations", async () => {
    mockMobileViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));

    const sheet = screen.getByRole("dialog", { name: /more destinations/i });
    expect(within(sheet).getByRole("link", { name: /^clients$/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /^projects$/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /^report$/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /^import$/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /^log out$/i })).toBeInTheDocument();
  });

  it("toggles the mobile More sheet closed when More is clicked again", async () => {
    mockMobileViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    const moreButton = screen.getByRole("button", { name: /^more$/i });
    fireEvent.click(moreButton);
    expect(screen.getByRole("dialog", { name: /more destinations/i })).toBeInTheDocument();

    fireEvent.click(moreButton);
    expect(screen.queryByRole("dialog", { name: /more destinations/i })).not.toBeInTheDocument();
  });

  it("navigates to Report from the mobile More sheet", async () => {
    mockMobileViewport();
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    fireEvent.click(screen.getByRole("link", { name: /^report$/i }));

    await waitFor(() => {
      expect(app.pathname).toBe("/report");
      expect(screen.getByRole("heading", { name: /^report$/i })).toBeInTheDocument();
    });
  });

  it("supports browser back after navigating away from Tracker", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /^invoices$/i }));

    await waitFor(() => {
      expect(app.pathname).toBe("/invoices");
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });

    act(() => {
      app.goBack();
    });

    await waitFor(() => {
      expect(app.pathname).toBe("/");
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });
  });
});
