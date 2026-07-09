import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TimeEntry } from "@hourden/domain";
import { fetchRunningTimer } from "../tracker/fetch-running-timer.js";
import { useWorkspaceEvents } from "../useWorkspaceEvents.js";
import { RunningTimerContext } from "./RunningTimerContext.js";

type RunningTimerProviderProps = {
  children: ReactNode;
};

export function RunningTimerProvider({ children }: RunningTimerProviderProps) {
  const [running, setRunning] = useState<TimeEntry | null>(null);

  const refresh = useCallback(async () => {
    const entry = await fetchRunningTimer();
    setRunning(entry);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useWorkspaceEvents({
    "timer-changed": () => {
      void refresh();
    },
  });

  const value = useMemo(
    () => ({
      running,
      startedAt: running?.startedAt ?? null,
      refresh,
      replaceRunning: setRunning,
    }),
    [running, refresh],
  );

  return (
    <RunningTimerContext.Provider value={value}>{children}</RunningTimerContext.Provider>
  );
}
