import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage.js";

describe("LoginPage", () => {
  it("renders on a dark semantic-token background", () => {
    render(<LoginPage />);
    const shell = screen.getByRole("heading", { name: /hourden/i }).closest("div");
    expect(shell?.parentElement).toHaveClass("bg-background");
    expect(shell).toHaveClass("bg-surface", "border-divider");
  });

  it("submits credentials to the login API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "operator@test.hourden.local" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "TestPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
    });
  });
});
