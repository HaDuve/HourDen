import { NavLink, useMatch } from "react-router-dom";
import { navLinkClass } from "./nav-link-class.js";

export function TodayNavLink() {
  const isRoot = useMatch({ path: "/", end: true }) !== null;
  const isTodayPath = useMatch({ path: "today", end: true }) !== null;

  return (
    <NavLink to="today" end className={navLinkClass({ isActive: isRoot || isTodayPath })}>
      Today
    </NavLink>
  );
}
