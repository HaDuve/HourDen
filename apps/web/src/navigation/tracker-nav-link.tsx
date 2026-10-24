import type { ComponentType } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LucideProps } from "lucide-react";
import { useLiveCounter } from "../tracker/useLiveCounter.js";
import { useRunningTimer } from "../running-timer/RunningTimerContext.js";
import { navLinkClass } from "./nav-link-class.js";
import { NAV_ICON_SIZE, NAV_ICON_STROKE_WIDTH, trackerNavIcon } from "./nav-destinations.js";

const TrackerIcon = trackerNavIcon;

type TrackerNavLinkProps = {
  /** Bottom-bar layout: icon stacked above a visible text label. */
  compact?: boolean;
};

export function TrackerNavLink({ compact = false }: TrackerNavLinkProps) {
  const { t } = useTranslation();
  const { startedAt } = useRunningTimer();
  const liveCounter = useLiveCounter(startedAt);
  const isRunning = startedAt !== null;
  const isRoot = useMatch({ path: "/", end: true }) !== null;
  const isTrackerPath = useMatch({ path: "/tracker", end: true }) !== null;

  const ariaLabel = isRunning
    ? t("tracker.timerRunning", { duration: liveCounter.text })
    : t("nav.tracker");
  const visibleLabel = isRunning ? liveCounter.text : t("nav.tracker");

  return (
    <NavLink
      to="/tracker"
      end
      className={navLinkClass({ isActive: isRoot || isTrackerPath })}
      aria-label={ariaLabel}
    >
      <span
        className={
          compact
            ? "inline-flex flex-col items-center gap-0.5"
            : "inline-flex items-center gap-1.5"
        }
      >
        <TrackerIcon
          size={NAV_ICON_SIZE}
          strokeWidth={NAV_ICON_STROKE_WIDTH}
          aria-hidden
          className="shrink-0"
        />
        <span
          className={
            compact
              ? `text-xs font-medium leading-tight${isRunning ? " font-numeric tabular-nums text-primary" : ""}`
              : isRunning
                ? "font-numeric tabular-nums text-primary"
                : undefined
          }
        >
          {visibleLabel}
        </span>
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
  /** Bottom-bar layout: icon stacked above a visible text label. */
  compact?: boolean;
};

export function NavDestinationLink({
  to,
  labelKey,
  icon: Icon,
  className,
  onClick,
  role,
  compact = false,
}: NavDestinationLinkProps) {
  const { t } = useTranslation();
  const label = t(labelKey);

  return (
    <NavLink
      to={to}
      className={className ?? navLinkClass}
      onClick={onClick}
      role={role}
      aria-label={compact ? label : undefined}
    >
      <span
        className={
          compact
            ? "inline-flex flex-col items-center gap-0.5"
            : "inline-flex items-center gap-1.5"
        }
      >
        <Icon
          size={NAV_ICON_SIZE}
          strokeWidth={NAV_ICON_STROKE_WIDTH}
          aria-hidden
          className="shrink-0"
        />
        <span className={compact ? "text-xs font-medium leading-tight" : undefined}>
          {label}
        </span>
      </span>
    </NavLink>
  );
}
