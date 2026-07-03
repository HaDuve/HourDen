import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateRangeFilter } from "./DateRangeFilter.js";

describe("DateRangeFilter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders from/to date inputs and month quick controls", () => {
    render(
      <DateRangeFilter
        from="2026-06-01"
        to="2026-06-30"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-06-01");
    expect(screen.getByLabelText(/^to$/i)).toHaveValue("2026-06-30");
    expect(screen.getByRole("button", { name: /^previous month$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^last month$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^this month$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next month$/i })).toBeInTheDocument();
  });

  it("sets this month when the this month quick control is clicked", () => {
    const onChange = vi.fn();
    vi.setSystemTime(new Date(2026, 5, 18));

    render(
      <DateRangeFilter
        from="2026-04-01"
        to="2026-04-30"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^this month$/i }));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("sets last month when the last month quick control is clicked", () => {
    const onChange = vi.fn();
    vi.setSystemTime(new Date(2026, 5, 18));

    render(
      <DateRangeFilter
        from="2026-06-01"
        to="2026-06-30"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^last month$/i }));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-05-01",
      to: "2026-05-31",
    });
  });

  it("shifts the current filter to the previous month when the left arrow is clicked", () => {
    const onChange = vi.fn();

    render(
      <DateRangeFilter
        from="2026-06-01"
        to="2026-06-30"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^previous month$/i }));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-05-01",
      to: "2026-05-31",
    });
  });

  it("shifts the current filter to the next month when the right arrow is clicked", () => {
    const onChange = vi.fn();

    render(
      <DateRangeFilter
        from="2026-06-01"
        to="2026-06-30"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^next month$/i }));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });
});
