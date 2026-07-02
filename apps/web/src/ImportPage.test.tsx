import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImportPage from "./ImportPage.js";

describe("ImportPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads selected CSV files and shows the import summary", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          imported: 3,
          duplicates: 0,
          skippedEmptyClient: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<ImportPage />);

    const csv = `"Project","Client","Description"
"Ondojo","Bandao","Development Call"`;
    const input = screen.getByLabelText(/clockify csv file/i);
    const file = new File([csv], "clockify.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /import/i }));

    await waitFor(() => {
      expect(screen.getByText(/imported 3 entries/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/import/clockify",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
