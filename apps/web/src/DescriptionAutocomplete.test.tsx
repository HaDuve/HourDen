import type { DescriptionSuggestion } from "@hourden/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptionAutocomplete } from "./DescriptionAutocomplete.js";

function ControlledAutocomplete({
  onSuggestionSelect,
}: {
  onSuggestionSelect: (suggestion: DescriptionSuggestion) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <DescriptionAutocomplete
      label="Description"
      value={value}
      onChange={setValue}
      onSuggestionSelect={onSuggestionSelect}
    />
  );
}

describe("DescriptionAutocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches matching suggestions after debounce and applies selection", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=rev") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [
              { description: "Code review", projectId: "p1" },
              { description: "Design review", projectId: "p2" },
            ],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const onSuggestionSelect = vi.fn();

    render(<ControlledAutocomplete onSuggestionSelect={onSuggestionSelect} />);

    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: "rev" },
    });

    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-entries/suggestions?q=rev");
      expect(screen.getByRole("option", { name: "Design review" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Design review" }));

    expect(screen.getByLabelText(/^description$/i)).toHaveValue("Design review");
    expect(onSuggestionSelect).toHaveBeenCalledWith({
      description: "Design review",
      projectId: "p2",
    });
  });
});
