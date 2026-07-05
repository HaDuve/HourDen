import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { navLinkClass } from "./nav-link-class.js";
import { TrackerNavLink } from "./tracker-nav-link.js";

const secondaryDestinations = [
  { to: "clients", label: "Clients" },
  { to: "projects", label: "Projects" },
  { to: "report", label: "Report" },
  { to: "import", label: "Import" },
] as const;

type AppNavigationProps = {
  isDesktop: boolean;
  onLogout: () => void;
};

function DesktopNavigation({ onLogout }: Pick<AppNavigationProps, "onLogout">) {
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
    <nav aria-label="Primary navigation" className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-8 py-3">
        <div className="flex flex-1 gap-1">
          <TrackerNavLink />
          <NavLink to="invoices" className={navLinkClass}>
            Invoices
          </NavLink>
          <div className="relative" ref={moreMenuRef}>
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

function MobileNavigation({ onLogout }: Pick<AppNavigationProps, "onLogout">) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white"
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-2">
          <div className="flex flex-1 justify-center">
            <TrackerNavLink />
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
              onClick={() => setIsMoreOpen((open) => !open)}
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

export default function AppNavigation({ isDesktop, onLogout }: AppNavigationProps) {
  return isDesktop ? <DesktopNavigation onLogout={onLogout} /> : <MobileNavigation onLogout={onLogout} />;
}
