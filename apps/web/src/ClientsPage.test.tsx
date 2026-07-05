import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "./i18n/i18n.js";
import ClientsPage from "./ClientsPage.js";
import { mockDesktopViewport } from "./test/viewport.js";

function renderClientsPage(initialEntry = "/clients") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ClientsPage />
    </MemoryRouter>,
  );
}

describe("ClientsPage", () => {
  beforeEach(async () => {
    mockDesktopViewport();
    await i18n.changeLanguage("en");
  });
  const bandaoClient = {
    id: "c0000000-0000-4000-8000-000000000001",
    name: "Bandao",
    defaultRate: 60,
    legalName: null,
    addressLine1: null,
    addressLine2: null,
  };
  const hannahClient = {
    id: "c0000000-0000-4000-8000-000000000002",
    name: "Hannah",
    defaultRate: 80,
    legalName: null,
    addressLine1: null,
    addressLine2: null,
  };

  it("opens the edit form when the edit query param matches a Client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clients: [hannahClient] }),
      }),
    );

    renderClientsPage(`/clients?edit=${hannahClient.id}`);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /edit client/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^name$/i)).toHaveValue("Hannah");
    });
  });

  it("opens the new-client form when the new query param is set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      }),
    );

    renderClientsPage("/clients?new=1");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /new client/i })).toBeInTheDocument();
    });
  });

  it("shows an empty state when there are no Clients", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clients: [] }),
      }),
    );

    renderClientsPage();

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

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
      expect(screen.getByText("€60.00/h")).toBeInTheDocument();
    });
  });

  it("shows a German catalog error when loading clients fails", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    renderClientsPage();

    await waitFor(() => {
      expect(
        screen.getByText("Kunden konnten nicht geladen werden"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Failed to load clients/i)).not.toBeInTheDocument();
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

    renderClientsPage();
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

  it("edits a Client through the form", async () => {
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
        json: async () => ({
          ...client,
          name: "Bandao GmbH",
          defaultRate: 65,
          legalName: "BANDAO Guidance GmbH",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          clients: [
            {
              ...client,
              name: "Bandao GmbH",
              defaultRate: 65,
              legalName: "BANDAO Guidance GmbH",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderClientsPage();
    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Bandao GmbH" },
    });
    fireEvent.change(screen.getByLabelText(/default rate/i), {
      target: { value: "65" },
    });
    fireEvent.change(screen.getByLabelText(/legal name/i), {
      target: { value: "BANDAO Guidance GmbH" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Bandao GmbH")).toBeInTheDocument();
      expect(screen.getByText("€65.00/h")).toBeInTheDocument();
      expect(screen.getByText(/Recipient: BANDAO Guidance GmbH/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clients/${client.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("deletes the Client chosen when the dialog opened, even if another row Delete is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient, hannahClient] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderClientsPage();
    await waitFor(() => {
      expect(screen.getByText("Hannah")).toBeInTheDocument();
    });

    const listDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(listDeleteButtons[1]!);

    await waitFor(() => {
      expect(
        screen.getByText(/this will permanently delete/i).closest("div"),
      ).toHaveTextContent("Hannah");
    });

    // Simulate a stray activation of the first row's Delete while the dialog is open.
    fireEvent.click(listDeleteButtons[0]!);

    const confirmButtons = screen.getAllByRole("button", { name: /^confirm delete$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/clients/${hannahClient.id}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("deletes the chosen Client when multiple Clients exist", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient, hannahClient] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderClientsPage();
    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
      expect(screen.getByText("Hannah")).toBeInTheDocument();
    });

    const listDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(listDeleteButtons[1]!);

    await waitFor(() => {
      expect(
        screen.getByText(/this will permanently delete/i).closest("div"),
      ).toHaveTextContent("Hannah");
    });

    const confirmButtons = screen.getAllByRole("button", { name: /^confirm delete$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.queryByText("Hannah")).not.toBeInTheDocument();
      expect(screen.getByText("Bandao")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clients/${hannahClient.id}`,
      expect.objectContaining({ method: "DELETE" }),
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

    renderClientsPage();
    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const confirmButtons = screen.getAllByRole("button", { name: /^confirm delete$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.getByText(/no clients yet/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clients/${client.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows an error when deleting a Client that has Projects", async () => {
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
        ok: false,
        status: 409,
        json: async () => ({
          error: "Cannot delete Client with existing Projects",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderClientsPage();
    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const confirmButtons = screen.getAllByRole("button", { name: /^confirm delete$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.getByText("Failed to delete client")).toBeInTheDocument();
    });
  });
});
