import { elapsedSecondsSince, formatElapsedHMMSS } from "@hourden/domain";
import { useEffect, useState } from "react";

export type LiveCounter = {
  text: string;
  elapsedSeconds: number;
  /** Wall clock used for Live Counter / Day Ribbon running block. */
  now: Date;
};

export function useLiveCounter(startedAt: string | null): LiveCounter {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [startedAt]);

  if (!startedAt) {
    return { text: formatElapsedHMMSS(0), elapsedSeconds: 0, now };
  }

  const elapsedSeconds = elapsedSecondsSince(startedAt, now);
  return {
    text: formatElapsedHMMSS(elapsedSeconds),
    elapsedSeconds,
    now,
  };
}
