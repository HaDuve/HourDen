import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "./App.js";
import ClientsPage from "./ClientsPage.js";
import ImportPage from "./ImportPage.js";
import InvoicesPage from "./InvoicesPage.js";
import ProjectsPage from "./ProjectsPage.js";
import ReportPage from "./ReportPage.js";
import TodayPage from "./TodayPage.js";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="import" element={<ImportPage />} />
      </Route>
    </Routes>
  );
}

function renderApp(initialPath = "/") {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: "today", element: <TodayPage /> },
          { path: "clients", element: <ClientsPage /> },
          { path: "projects", element: <ProjectsPage /> },
          { path: "report", element: <ReportPage /> },
          { path: "invoices", element: <InvoicesPage /> },
          { path: "import", element: <ImportPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function renderAppWithMemoryRouter(initialPath = "/") {
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
      <LocationObserver />
      <NavigateCapture />
      <AppRoutes />
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
    if (url === "/api/invoices") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ invoices: [] }),
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

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
    });
  });

  it("navigates to the Invoices page and updates the URL", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/");

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

  it("supports browser back after navigating away from Today", async () => {
    vi.stubGlobal("fetch", mockAppFetch());

    const app = renderAppWithMemoryRouter("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
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
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
    });
  });
});
