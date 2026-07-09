import type { ComponentType } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LucideProps } from "lucide-react";
import { useIsMobile } from "../layout/use-is-mobile.js";
import { useLiveCounter } from "../tracker/useLiveCounter.js";
import { useRunningTimer } from "../running-timer/RunningTimerContext.js";
import { navLinkClass } from "./nav-link-class.js";
import { NAV_ICON_SIZE, NAV_ICON_STROKE_WIDTH, trackerNavIcon } from "./nav-destinations.js";

const TrackerIcon = trackerNavIcon;

export function TrackerNavLink() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { startedAt } = useRunningTimer();
  const liveCounter = useLiveCounter(startedAt);
  const isRunning = startedAt !== null;
  const isRoot = useMatch({ path: "/", end: true }) !== null;
  const isTrackerPath = useMatch({ path: "/tracker", end: true }) !== null;

  const ariaLabel = isRunning
    ? t("tracker.timerRunning", { duration: liveCounter })
    : t("nav.tracker");
  const desktopLabel = isRunning ? liveCounter : t("nav.tracker");

  return (
    <NavLink
      to="/tracker"
      end
      className={navLinkClass({ isActive: isRoot || isTrackerPath })}
      aria-label={ariaLabel}
    >
      <span className="inline-flex items-center gap-1.5">
        <TrackerIcon
          size={NAV_ICON_SIZE}
          strokeWidth={NAV_ICON_STROKE_WIDTH}
          aria-hidden
          className="shrink-0"
        />
        {isMobile ? (
          <span className="sr-only">{desktopLabel}</span>
        ) : (
          <span className={isRunning ? "font-mono tabular-nums" : undefined}>{desktopLabel}</span>
        )}
      </span>
    </NavLink>
  );
}

type NavDestinationLinkProps = {
  to: string;
  labelKey: string;
  icon: ComponentType<LucideProps>;
  className?: string | ((args: { isActive: boolean }) => string);
  onClick?: () => void;
  role?: string;
  iconOnly?: boolean;
};

export function NavDestinationLink({
  to,
  labelKey,
  icon: Icon,
  className,
  onClick,
  role,
  iconOnly = false,
}: NavDestinationLinkProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const label = t(labelKey);
  const hideLabel = iconOnly || isMobile;

  return (
    <NavLink
      to={to}
      className={className ?? navLinkClass}
      onClick={onClick}
      role={role}
      aria-label={hideLabel ? label : undefined}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon
          size={NAV_ICON_SIZE}
          strokeWidth={NAV_ICON_STROKE_WIDTH}
          aria-hidden
          className="shrink-0"
        />
        {hideLabel ? <span className="sr-only">{label}</span> : <span>{label}</span>}
      </span>
    </NavLink>
  );
}
