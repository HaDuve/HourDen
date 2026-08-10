import { fireEvent, within } from "@testing-library/react";

/** Drive timer-bar schedule: time inputs + calendar icon (not datetime-local). */
export function setTimerBarSchedule(
  bar: HTMLElement,
  schedule: { date: string; startTime?: string; endTime?: string },
) {
  const calendar = within(bar).queryByRole("button", { name: /change date:/i });
  const currentDate = calendar?.getAttribute("title") ?? "";
  if (currentDate !== schedule.date) {
    if (calendar) {
      fireEvent.click(calendar);
    }
    const dateInput = within(bar).getByLabelText(/^date$/i);
    fireEvent.change(dateInput, { target: { value: schedule.date } });
    fireEvent.blur(dateInput);
  }
  if (schedule.startTime !== undefined) {
    fireEvent.change(within(bar).getByLabelText(/^start$/i), {
      target: { value: schedule.startTime },
    });
  }
  if (schedule.endTime !== undefined) {
    fireEvent.change(within(bar).getByLabelText(/^end$/i), {
      target: { value: schedule.endTime },
    });
  }
}

export function localDateAndTime(localDatetime: string): {
  date: string;
  time: string;
} {
  return {
    date: localDatetime.slice(0, 10),
    time: localDatetime.slice(11, 16),
  };
}
