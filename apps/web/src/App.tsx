import { NavLink, Outlet, useMatch } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
  }`;

function TodayNavLink() {
  const isRoot = useMatch({ path: "/", end: true }) !== null;
  const isTodayPath = useMatch({ path: "today", end: true }) !== null;

  return (
    <NavLink to="today" end className={navLinkClass({ isActive: isRoot || isTodayPath })}>
      Today
    </NavLink>
  );
}

export default function AppLayout() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  return (
    <div>
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-8 py-3">
          <div className="flex flex-1 gap-1">
            <TodayNavLink />
            <NavLink to="clients" className={navLinkClass}>
              Clients
            </NavLink>
            <NavLink to="projects" className={navLinkClass}>
              Projects
            </NavLink>
            <NavLink to="report" className={navLinkClass}>
              Report
            </NavLink>
            <NavLink to="invoices" className={navLinkClass}>
              Invoices
            </NavLink>
            <NavLink to="import" className={navLinkClass}>
              Import
            </NavLink>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Log out
          </button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
