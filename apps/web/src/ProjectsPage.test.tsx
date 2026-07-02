import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProjectsPage from "./ProjectsPage.js";

const bandaoClient = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Bandao",
  defaultRate: 60,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
};

describe("ProjectsPage", () => {
  it("shows Projects for the selected Client", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "p0000000-0000-4000-8000-000000000001",
              clientId: bandaoClient.id,
              name: "Ondojo",
              color: "#3b82f6",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^client$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^client$/i), {
      target: { value: bandaoClient.id },
    });

    await waitFor(() => {
      expect(screen.getByText("Ondojo")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects?clientId=${bandaoClient.id}`,
    );
  });

  it("creates a Project through the form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: "p0000000-0000-4000-8000-000000000002",
          clientId: bandaoClient.id,
          name: "Ondojo",
          color: "#3b82f6",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "p0000000-0000-4000-8000-000000000002",
              clientId: bandaoClient.id,
              name: "Ondojo",
              color: "#3b82f6",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/^client$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^client$/i), {
      target: { value: bandaoClient.id },
    });
    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Ondojo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Ondojo")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("deletes a Project after confirmation", async () => {
    const project = {
      id: "p0000000-0000-4000-8000-000000000001",
      clientId: bandaoClient.id,
      name: "Ondojo",
      color: null,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [project] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/^client$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^client$/i), {
      target: { value: bandaoClient.id },
    });
    await waitFor(() => {
      expect(screen.getByText("Ondojo")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const confirmButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${project.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
