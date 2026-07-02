import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClientsPage from "./ClientsPage.js";

describe("ClientsPage", () => {
  it("shows an empty state when there are no Clients", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clients: [] }),
      }),
    );

    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no clients yet/i)).toBeInTheDocument();
    });
  });

  it("lists Clients returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          clients: [
            {
              id: "c0000000-0000-4000-8000-000000000001",
              name: "Bandao",
              defaultRate: 60,
              legalName: null,
              addressLine1: null,
              addressLine2: null,
            },
          ],
        }),
      }),
    );

    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
      expect(screen.getByText("60 €/h")).toBeInTheDocument();
    });
  });

  it("creates a Client through the form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: "c0000000-0000-4000-8000-000000000002",
          name: "Hannah",
          defaultRate: 80,
          legalName: null,
          addressLine1: null,
          addressLine2: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          clients: [
            {
              id: "c0000000-0000-4000-8000-000000000002",
              name: "Hannah",
              defaultRate: 80,
              legalName: null,
              addressLine1: null,
              addressLine2: null,
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ClientsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no clients yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /new client/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Hannah" },
    });
    fireEvent.change(screen.getByLabelText(/default rate/i), {
      target: { value: "80" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Hannah")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clients",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("deletes a Client after confirmation", async () => {
    const client = {
      id: "c0000000-0000-4000-8000-000000000001",
      name: "Bandao",
      defaultRate: 60,
      legalName: null,
      addressLine1: null,
      addressLine2: null,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [client] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ClientsPage />);
    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const confirmButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.getByText(/no clients yet/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clients/${client.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
