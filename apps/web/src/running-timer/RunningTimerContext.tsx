import { createContext, useContext } from "react";
import type { TimeEntry } from "@hourden/domain";

export type RunningTimerContextValue = {
  running: TimeEntry | null;
  startedAt: string | null;
  refresh: () => Promise<void>;
  replaceRunning: (entry: TimeEntry | null) => void;
  remoteStopNotice: boolean;
  dismissRemoteStopNotice: () => void;
  suppressRemoteStopNotice: () => void;
};

export const RunningTimerContext = createContext<RunningTimerContextValue | null>(null);

export function useRunningTimer(): RunningTimerContextValue {
  const value = useContext(RunningTimerContext);
  if (!value) {
    throw new Error("useRunningTimer must be used within RunningTimerProvider");
  }
  return value;
}
