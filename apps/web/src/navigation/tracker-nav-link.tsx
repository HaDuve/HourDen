import { NavLink, useMatch } from "react-router-dom";
import { navLinkClass } from "./nav-link-class.js";

export function TrackerNavLink() {
  const isRoot = useMatch({ path: "/", end: true }) !== null;
  const isTrackerPath = useMatch({ path: "tracker", end: true }) !== null;

  return (
    <NavLink to="tracker" end className={navLinkClass({ isActive: isRoot || isTrackerPath })}>
      Tracker
    </NavLink>
  );
}
