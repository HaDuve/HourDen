import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TimeEntry } from "@hourden/domain";
import { fetchRunningTimer } from "../tracker/fetch-running-timer.js";
import { useWorkspaceEvents } from "../useWorkspaceEvents.js";
import { RunningTimerContext } from "./RunningTimerContext.js";

type RunningTimerProviderProps = {
  children: ReactNode;
};

export function RunningTimerProvider({ children }: RunningTimerProviderProps) {
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [remoteStopNotice, setRemoteStopNotice] = useState(false);
  const suppressRemoteStopNoticeRef = useRef(false);
  const runningRef = useRef<TimeEntry | null>(null);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const refresh = useCallback(async () => {
    try {
      const entry = await fetchRunningTimer();
      setRunning(entry);
    } catch {
      // Ignore fetch failures during teardown or transient API errors.
    }
  }, []);

  const refreshAfterRemoteChange = useCallback(async () => {
    const previousRunningId = runningRef.current?.id ?? null;
    let entry: TimeEntry | null = null;
    try {
      entry = await fetchRunningTimer();
      setRunning(entry);
    } catch {
      return;
    }

    if (suppressRemoteStopNoticeRef.current) {
      suppressRemoteStopNoticeRef.current = false;
      return;
    }

    if (previousRunningId && entry && entry.id !== previousRunningId) {
      setRemoteStopNotice(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useWorkspaceEvents({
    "timer-changed": () => {
      void refreshAfterRemoteChange();
    },
  });

  const dismissRemoteStopNotice = useCallback(() => {
    setRemoteStopNotice(false);
  }, []);

  const suppressRemoteStopNotice = useCallback(() => {
    suppressRemoteStopNoticeRef.current = true;
    setRemoteStopNotice(false);
  }, []);

  const value = useMemo(
    () => ({
      running,
      startedAt: running?.startedAt ?? null,
      refresh,
      replaceRunning: setRunning,
      remoteStopNotice,
      dismissRemoteStopNotice,
      suppressRemoteStopNotice,
    }),
    [running, refresh, remoteStopNotice, dismissRemoteStopNotice, suppressRemoteStopNotice],
  );

  return (
    <RunningTimerContext.Provider value={value}>{children}</RunningTimerContext.Provider>
  );
}
