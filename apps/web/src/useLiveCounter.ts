import { useEffect, useState } from "react";

export function elapsedSecondsFromStartedAt(
  startedAt: string,
  nowMs: number = Date.now(),
): number {
  const elapsedMs = nowMs - new Date(startedAt).getTime();
  return Math.max(0, Math.floor(elapsedMs / 1_000));
}

export function formatElapsedDuration(totalSeconds: number): string {
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min ${seconds} sec`;
  }
  if (totalMinutes > 0) {
    return `${totalMinutes} min ${seconds} sec`;
  }
  return `${seconds} sec`;
}

export function useLiveCounter(startedAt: string | null): string | null {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    startedAt ? elapsedSecondsFromStartedAt(startedAt) : 0,
  );

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const tick = () => {
      setElapsedSeconds(elapsedSecondsFromStartedAt(startedAt));
    };

    tick();
    const intervalId = setInterval(tick, 1_000);
    return () => {
      clearInterval(intervalId);
    };
  }, [startedAt]);

  if (!startedAt) {
    return null;
  }

  return formatElapsedDuration(elapsedSeconds);
}
