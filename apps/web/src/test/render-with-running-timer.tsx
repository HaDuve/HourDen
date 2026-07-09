import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { RunningTimerProvider } from "../running-timer/RunningTimerProvider.js";

export function renderWithRunningTimer(ui: ReactElement) {
  return render(<RunningTimerProvider>{ui}</RunningTimerProvider>);
}
