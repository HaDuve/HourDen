import { useTranslation } from "react-i18next";
import { infoPanelClass, secondaryButtonClass } from "../layout/ui-classes.js";
import { useRunningTimer } from "../running-timer/RunningTimerContext.js";

export function RemoteStopNoticeBanner() {
  const { t } = useTranslation();
  const { remoteStopNotice, dismissRemoteStopNotice } = useRunningTimer();

  if (!remoteStopNotice) {
    return null;
  }

  return (
    <div
      className={`${infoPanelClass} mx-4 mt-3 flex items-center justify-between gap-3`}
      role="status"
    >
      <p>{t("tracker.remoteStopNotice")}</p>
      <button type="button" className={secondaryButtonClass} onClick={dismissRemoteStopNotice}>
        {t("tracker.dismissNotice")}
      </button>
    </div>
  );
}
