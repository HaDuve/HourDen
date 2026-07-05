import { elapsedSecondsSince, formatElapsedHMMSS } from "@hourden/domain";
import { useEffect, useState } from "react";

export function useLiveCounter(startedAt: string | null): string {
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
    return formatElapsedHMMSS(0);
  }

  return formatElapsedHMMSS(elapsedSecondsSince(startedAt, now));
}
