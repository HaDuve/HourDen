import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import { DateRangeFilter } from "./DateRangeFilter.js";

describe("DateRangeFilter", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows explicit month quick-control labels instead of terse abbreviations", () => {
    render(
      <DateRangeFilter
        from="2026-06-01"
        to="2026-06-30"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^last month$/i })).toHaveTextContent(
      "Last month",
    );
    expect(screen.getByRole("button", { name: /^this month$/i })).toHaveTextContent(
      "This month",
    );
  });

  it("shows German month quick-control labels when the active locale is de", async () => {
    await i18n.changeLanguage("de");

    render(
      <DateRangeFilter
        from="2026-06-01"
        to="2026-06-30"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^letzter monat$/i })).toHaveTextContent(
      "Letzter Monat",
    );
    expect(screen.getByRole("button", { name: /^dieser monat$/i })).toHaveTextContent(
      "Dieser Monat",
    );
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

  it("marks this month as pressed when the range is the full current month", () => {
    vi.setSystemTime(new Date(2026, 5, 18));

    render(
      <DateRangeFilter
        from="2026-06-01"
        to="2026-06-30"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^this month$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^last month$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks last month as pressed when the range is the full previous month", () => {
    vi.setSystemTime(new Date(2026, 5, 18));

    render(
      <DateRangeFilter
        from="2026-05-01"
        to="2026-05-31"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^last month$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^this month$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks neither quick control as pressed for a partial month range", () => {
    vi.setSystemTime(new Date(2026, 5, 18));

    render(
      <DateRangeFilter
        from="2026-06-15"
        to="2026-06-30"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^this month$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /^last month$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
