import { elapsedSecondsSince } from "@hourden/domain";
import { useEffect } from "react";
import { useLocaleFormat } from "../locale/use-locale-format.js";
import { formatAbbreviatedElapsed } from "../locale/format.js";
import { useLiveCounter } from "../tracker/useLiveCounter.js";
import { useRunningTimer } from "../running-timer/RunningTimerContext.js";
import { APP_TITLE } from "./constants.js";

export function useDocumentTitle(): void {
  const { startedAt } = useRunningTimer();
  const { locale } = useLocaleFormat();
  const liveCounter = useLiveCounter(startedAt);

  useEffect(() => {
    if (!startedAt) {
      document.title = APP_TITLE;
      return;
    }

    const updateTitle = () => {
      const seconds = elapsedSecondsSince(startedAt);
      const abbreviated = formatAbbreviatedElapsed(seconds, locale);
      document.title = `${abbreviated} • ${APP_TITLE}`;
    };

    updateTitle();
    const intervalId = setInterval(updateTitle, 1000);
    return () => {
      clearInterval(intervalId);
      document.title = APP_TITLE;
    };
  }, [startedAt, locale, liveCounter]);
}
