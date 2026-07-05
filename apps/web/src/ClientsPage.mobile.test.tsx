import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ClientsPage from "./ClientsPage.js";
import { mockMobileViewport } from "./test/viewport.js";

function renderClientsPage(initialEntry = "/clients") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ClientsPage />
    </MemoryRouter>,
  );
}

const bandaoClient = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Bandao",
  defaultRate: 60,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
};

describe("ClientsPage mobile layout", () => {
  it("renders client rows as stacked cards on mobile", async () => {
    mockMobileViewport();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      }),
    );

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByTestId("client-card")).toBeInTheDocument();
    });

    expect(screen.getByText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByText(/default rate \(€\/h\)/i)).toBeInTheDocument();
  });

  it("opens the edit form as a bottom sheet on mobile", async () => {
    mockMobileViewport();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      }),
    );

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-presentation",
      "sheet",
    );
  });
});
