import type { DescriptionSuggestion } from "@hourden/domain";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    vi.unstubAllGlobals();
  });

  it("shows placeholder and aria-label without visible label when hideLabel is set", () => {
    render(
      <DescriptionAutocomplete
        label="Description"
        hideLabel
        value=""
        onChange={vi.fn()}
        onSuggestionSelect={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/^description$/i);
    expect(input).toHaveAttribute("placeholder", "Description");
    expect(screen.queryByText(/^description$/i)).not.toBeInTheDocument();
  });

  it("uses custom placeholder when hideLabel and placeholder are set", () => {
    render(
      <DescriptionAutocomplete
        label="Description"
        hideLabel
        placeholder="What did you work on?"
        value=""
        onChange={vi.fn()}
        onSuggestionSelect={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("What did you work on?")).toBeInTheDocument();
    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
  });

  it("fetches matching suggestions after debounce and applies selection", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ suggestions: [] }),
        });
      }
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

    const input = screen.getByLabelText(/^description$/i);
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "rev" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

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

  it("opens last recent descriptions on focus when the field is empty", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [
              { description: "Fourth distinct", projectId: "p1" },
              { description: "Newest work", projectId: "p2" },
              { description: "Middle work", projectId: "p3" },
            ],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const onSuggestionSelect = vi.fn();

    render(<ControlledAutocomplete onSuggestionSelect={onSuggestionSelect} />);

    fireEvent.focus(screen.getByLabelText(/^description$/i));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-entries/suggestions?q=");
      expect(screen.getByRole("option", { name: "Newest work" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Newest work" }));

    expect(screen.getByLabelText(/^description$/i)).toHaveValue("Newest work");
    expect(onSuggestionSelect).toHaveBeenCalledWith({
      description: "Newest work",
      projectId: "p2",
    });
  });

  it("replaces recent suggestions with typed matches", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [
              { description: "Fourth distinct", projectId: "p1" },
              { description: "Newest work", projectId: "p2" },
              { description: "Middle work", projectId: "p3" },
            ],
          }),
        });
      }
      if (url === "/api/time-entries/suggestions?q=rev") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [{ description: "Design review", projectId: "p2" }],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ControlledAutocomplete onSuggestionSelect={vi.fn()} />);

    const input = screen.getByLabelText(/^description$/i);
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Newest work" })).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: "rev" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-entries/suggestions?q=rev");
      expect(screen.getByRole("option", { name: "Design review" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Newest work" })).not.toBeInTheDocument();
    });
  });

  it("opens typed matches after selecting a recent suggestion", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [
              { description: "Newest work", projectId: "p2" },
              { description: "Middle work", projectId: "p3" },
            ],
          }),
        });
      }
      if (url === "/api/time-entries/suggestions?q=Newest%20work") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [{ description: "Newest work", projectId: "p2" }],
          }),
        });
      }
      if (url === "/api/time-entries/suggestions?q=rev") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [{ description: "Design review", projectId: "p2" }],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ControlledAutocomplete onSuggestionSelect={vi.fn()} />);

    const input = screen.getByLabelText(/^description$/i);
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Newest work" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Newest work" }));
    fireEvent.change(input, { target: { value: "rev" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Design review" })).toBeInTheDocument();
    });
  });

  it("does not call onBlur when a suggestion is selected", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [{ description: "Newest work", projectId: "p2" }],
          }),
        });
      }
      if (url === "/api/time-entries/suggestions?q=Newest%20work") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [{ description: "Newest work", projectId: "p2" }],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const onBlur = vi.fn();
    const onSuggestionSelect = vi.fn();

    function ControlledWithBlur() {
      const [value, setValue] = useState("");
      return (
        <DescriptionAutocomplete
          label="Description"
          value={value}
          onChange={setValue}
          onSuggestionSelect={onSuggestionSelect}
          onBlur={onBlur}
        />
      );
    }

    render(<ControlledWithBlur />);

    fireEvent.focus(screen.getByLabelText(/^description$/i));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Newest work" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Newest work" }));
    fireEvent.blur(screen.getByLabelText(/^description$/i));

    expect(onSuggestionSelect).toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
  });

  it("keeps the suggestion list closed after activating an option", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ suggestions: [] }),
        });
      }
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
      if (url === "/api/time-entries/suggestions?q=Design%20review") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [{ description: "Design review", projectId: "p2" }],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ControlledAutocomplete onSuggestionSelect={vi.fn()} />);

    const input = screen.getByLabelText(/^description$/i);
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "rev" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Design review" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Design review" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^description$/i)).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/time-entries/suggestions?q=Design%20review",
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^description$/i)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("shows suggestions after focus when description already has text", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/time-entries/suggestions?q=rev") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [{ description: "Code review", projectId: "p1" }],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DescriptionAutocomplete
        label="Description"
        value="rev"
        onChange={vi.fn()}
        onSuggestionSelect={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByLabelText(/^description$/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Code review" }),
      ).toBeInTheDocument();
    });
  });
});
