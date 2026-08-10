import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../i18n/i18n.js";
import { EntryScheduleFields } from "./EntryScheduleFields.js";

describe("EntryScheduleFields", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("edits start and end as times and the shared date only via the calendar icon", () => {
    const onChange = vi.fn();
    render(
      <EntryScheduleFields
        value={{ date: "2026-07-02", startTime: "08:00", endTime: "09:00" }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText(/^start$/i)).toHaveAttribute("type", "time");
    expect(screen.getByLabelText(/^end$/i)).toHaveAttribute("type", "time");
    expect(screen.queryByLabelText(/^date$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^change date$/i }));
    const dateInput = screen.getByLabelText(/^date$/i);
    expect(dateInput).toHaveAttribute("type", "date");
    fireEvent.change(dateInput, { target: { value: "2026-07-05" } });

    expect(onChange).toHaveBeenCalledWith({
      date: "2026-07-05",
      startTime: "08:00",
      endTime: "09:00",
    });
  });
});
