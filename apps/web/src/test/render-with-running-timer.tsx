import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { RunningTimerProvider } from "../running-timer/RunningTimerProvider.js";

export function renderWithRunningTimer(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <RunningTimerProvider>{ui}</RunningTimerProvider>
    </MemoryRouter>,
  );
}
