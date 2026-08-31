import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import i18n from "./i18n/i18n.js";
import { appRoutes } from "./routes.js";

function renderLogin(initialPath = "/login") {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("en");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("LoginPage", () => {
  it("renders on a dark semantic-token background", () => {
    renderLogin("/login");
    const shell = screen.getByRole("heading", { name: /hourden/i }).closest("div");
    expect(shell?.parentElement).toHaveClass("bg-background");
    expect(shell).toHaveClass("bg-surface", "border-divider");
  });

  it("shows Sign in tab by default with the login form", () => {
    renderLogin("/login");

    expect(screen.getByRole("tab", { name: /sign in/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /create account/i, selected: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
  });

  it("opens the Create account tab when clicked", () => {
    renderLogin("/login");

    fireEvent.click(screen.getByRole("tab", { name: /create account/i }));

    expect(screen.getByRole("tab", { name: /create account/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create account$/i })).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters with uppercase, lowercase, and a digit/i)).toBeInTheDocument();
  });

  it("opens Create account when visiting /login?mode=signup", () => {
    renderLogin("/login?mode=signup");

    expect(screen.getByRole("tab", { name: /create account/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create account$/i })).toBeInTheDocument();
  });

  it("redirects /signup to /login?mode=signup", async () => {
    const router = renderLogin("/signup");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
      expect(router.state.location.search).toBe("?mode=signup");
    });
    expect(screen.getByRole("tab", { name: /create account/i, selected: true })).toBeInTheDocument();
  });

  it("submits credentials to the login API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLogin("/login");

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "operator@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "TestPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: "operator@test.hourden.local",
            password: "TestPass1",
          }),
        }),
      );
    });
  });

  it("switches language from the public card without calling the locale API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderLogin("/login");

    fireEvent.click(screen.getByRole("radio", { name: /^de$/i }));

    await waitFor(() => {
      expect(localStorage.getItem("hourden.locale")).toBe("de");
      expect(i18n.language).toBe("de");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits signup with turnstile token, browser timezone, and active locale", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        user: { email: "new@test.hourden.local", locale: "de" },
        activeWorkspaceId: "ws-1",
        calendarTimezone: "Europe/Berlin",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Intl", {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: "Europe/Berlin" }),
      }),
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/login?mode=signup" },
      writable: true,
    });

    await i18n.changeLanguage("de");
    renderLogin("/login?mode=signup");

    fireEvent.change(screen.getByLabelText(/^e-mail$/i), {
      target: { value: "new@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/^passwort$/i), {
      target: { value: "RegisterPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^konto erstellen$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: "new@test.hourden.local",
            password: "RegisterPass1",
            turnstileToken: "test-turnstile-token",
            calendarTimezone: "Europe/Berlin",
            locale: "de",
          }),
        }),
      );
      expect(window.location.href).toBe("/");
    });
  });

  it("shows generic login failure copy for invalid credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid email or password" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLogin("/login");

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "wrong@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "WrongPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid email or password/i);
    });
  });

  it("shows generic signup failure copy for duplicate email", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Unable to register" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLogin("/login?mode=signup");

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "existing@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "RegisterPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not create account/i);
    });
  });

  it("shows API validation copy for weak passwords", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Password must include a digit" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLogin("/login?mode=signup");

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "new@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "RegisterPass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/password must include a digit/i);
    });
  });

  it("shows verification failure copy when CAPTCHA fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Verification failed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLogin("/login?mode=signup");

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "new@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "RegisterPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/verification failed/i);
    });
  });

  it("shows rate-limit copy for login throttling", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many requests" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLogin("/login");

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "operator@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "TestPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/too many attempts/i);
    });
  });
});
