import { useState } from "react";
import { NavLink } from "react-router-dom";
import { navLinkClass } from "./nav-link-class.js";
import { TodayNavLink } from "./today-nav-link.js";
import { DESKTOP_MEDIA_QUERY } from "./media-query.js";
import { useMediaQuery } from "./use-media-query.js";

const secondaryDestinations = [
  { to: "clients", label: "Clients" },
  { to: "projects", label: "Projects" },
  { to: "report", label: "Report" },
  { to: "import", label: "Import" },
] as const;

type AppNavigationProps = {
  onLogout: () => void;
};

function DesktopNavigation({ onLogout }: AppNavigationProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <nav aria-label="Primary navigation" className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-8 py-3">
        <div className="flex flex-1 gap-1">
          <TodayNavLink />
          <NavLink to="invoices" className={navLinkClass}>
            Invoices
          </NavLink>
          <div className="relative">
            <button
              type="button"
              aria-expanded={isMoreOpen}
              aria-haspopup="menu"
              onClick={() => setIsMoreOpen((open) => !open)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              More
            </button>
            {isMoreOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-1 min-w-40 rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
              >
                {secondaryDestinations.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    role="menuitem"
                    className={({ isActive }) =>
                      `block px-3 py-2 text-sm ${
                        isActive ? "bg-slate-100 font-medium text-slate-900" : "text-neutral-700 hover:bg-neutral-50"
                      }`
                    }
                    onClick={() => setIsMoreOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMoreOpen(false);
                    onLogout();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}

function MobileNavigation({ onLogout }: AppNavigationProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white"
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-2">
          <div className="flex flex-1 justify-center">
            <TodayNavLink />
          </div>
          <div className="flex flex-1 justify-center">
            <NavLink to="invoices" className={navLinkClass}>
              Invoices
            </NavLink>
          </div>
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen(true)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              More
            </button>
          </div>
        </div>
      </nav>
      {isMoreOpen ? (
        <div
          role="dialog"
          aria-label="More destinations"
          aria-modal="true"
          className="fixed inset-0 z-30 flex items-end bg-black/40"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-xl border border-neutral-200 bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">More</h2>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {secondaryDestinations.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm ${
                      isActive ? "bg-slate-100 font-medium text-slate-900" : "text-neutral-700 hover:bg-neutral-50"
                    }`
                  }
                  onClick={() => setIsMoreOpen(false)}
                >
                  {label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onLogout();
                }}
                className="rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function AppNavigation({ onLogout }: AppNavigationProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

  return isDesktop ? <DesktopNavigation onLogout={onLogout} /> : <MobileNavigation onLogout={onLogout} />;
}
