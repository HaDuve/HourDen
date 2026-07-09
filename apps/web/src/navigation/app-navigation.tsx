import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { LanguageSwitcher } from "../layout/LanguageSwitcher.js";
import { navLinkClass } from "./nav-link-class.js";
import {
  moreNavIcon,
  NAV_ICON_SIZE,
  NAV_ICON_STROKE_WIDTH,
  primaryNavDestinations,
  secondaryNavDestinations,
} from "./nav-destinations.js";
import { NavDestinationLink, TrackerNavLink } from "./tracker-nav-link.js";

const MoreIcon = moreNavIcon;

type AppNavigationProps = {
  isDesktop: boolean;
  onLogout: () => void;
};

function DesktopNavigation({ onLogout }: Pick<AppNavigationProps, "onLogout">) {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (moreMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsMoreOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);

  return (
    <nav aria-label={t("nav.primary")} className="border-b border-divider bg-surface">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-8 py-3">
        <div className="flex flex-1 gap-1">
          <TrackerNavLink />
          {primaryNavDestinations.map(({ to, labelKey, icon }) => (
            <NavDestinationLink key={to} to={to} labelKey={labelKey} icon={icon} />
          ))}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              aria-expanded={isMoreOpen}
              aria-haspopup="menu"
              onClick={() => setIsMoreOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-content"
            >
              <MoreIcon
                size={NAV_ICON_SIZE}
                strokeWidth={NAV_ICON_STROKE_WIDTH}
                aria-hidden
                className="shrink-0"
              />
              {t("nav.more")}
            </button>
            {isMoreOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-1 min-w-48 rounded-md border border-divider bg-surface py-1 shadow-lg"
              >
                {secondaryNavDestinations.map(({ to, labelKey, icon }) => (
                  <NavDestinationLink
                    key={to}
                    to={to}
                    labelKey={labelKey}
                    icon={icon}
                    role="menuitem"
                    className={({ isActive }) =>
                      `block px-3 py-2 text-sm ${
                        isActive
                          ? "bg-surface-active font-medium text-content"
                          : "text-muted hover:bg-surface-hover hover:text-content"
                      }`
                    }
                    onClick={() => setIsMoreOpen(false)}
                  />
                ))}
                <LanguageSwitcher />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMoreOpen(false);
                    onLogout();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface-hover hover:text-content"
                >
                  {t("nav.logout")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}

function MobileNavigation({ onLogout }: Pick<AppNavigationProps, "onLogout">) {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label={t("nav.mobile")}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-divider bg-surface"
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-2">
          <div className="flex flex-1 justify-center">
            <TrackerNavLink />
          </div>
          {primaryNavDestinations.map(({ to, labelKey, icon }) => (
            <div key={to} className="flex flex-1 justify-center">
              <NavDestinationLink to={to} labelKey={labelKey} icon={icon} iconOnly />
            </div>
          ))}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              aria-expanded={isMoreOpen}
              aria-label={t("nav.more")}
              onClick={() => setIsMoreOpen((open) => !open)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-content"
            >
              <MoreIcon
                size={NAV_ICON_SIZE}
                strokeWidth={NAV_ICON_STROKE_WIDTH}
                aria-hidden
                className="mx-auto shrink-0"
              />
            </button>
          </div>
        </div>
      </nav>
      {isMoreOpen ? (
        <div
          role="dialog"
          aria-label={t("nav.moreDestinations")}
          aria-modal="true"
          className="fixed inset-0 z-30 flex items-end bg-background/80"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-xl border border-divider bg-surface p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-content">{t("nav.more")}</h2>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-hover hover:text-content"
              >
                {t("nav.close")}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {secondaryNavDestinations.map(({ to, labelKey, icon }) => (
                <NavDestinationLink
                  key={to}
                  to={to}
                  labelKey={labelKey}
                  icon={icon}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? "bg-surface-active font-medium text-content"
                        : "text-muted hover:bg-surface-hover hover:text-content"
                    }`
                  }
                  onClick={() => setIsMoreOpen(false)}
                />
              ))}
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onLogout();
                }}
                className="rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-hover hover:text-content"
              >
                {t("nav.logout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function AppNavigation({ isDesktop, onLogout }: AppNavigationProps) {
  return isDesktop ? <DesktopNavigation onLogout={onLogout} /> : <MobileNavigation onLogout={onLogout} />;
}
