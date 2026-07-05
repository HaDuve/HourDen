import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProjectsPage from "./ProjectsPage.js";
import { mockMobileViewport } from "./test/viewport.js";

const bandaoClient = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Bandao",
  defaultRate: 60,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
};

const ondojoProject = {
  id: "p0000000-0000-4000-8000-000000000001",
  clientId: bandaoClient.id,
  name: "Ondojo",
  color: "#3b82f6",
};

describe("ProjectsPage mobile layout", () => {
  it("renders project rows as label-value cards on mobile", async () => {
    mockMobileViewport();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ projects: [ondojoProject] }),
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
      expect(screen.getByTestId("project-card")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Ondojo")).toBeInTheDocument();
    });
  });

  it("opens the edit form as a bottom sheet on mobile", async () => {
    mockMobileViewport();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ projects: [ondojoProject] }),
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

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-presentation",
      "sheet",
    );
  });
});
