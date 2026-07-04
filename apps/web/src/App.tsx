import { Outlet } from "react-router-dom";
import AppNavigation from "./navigation/app-navigation.js";
import { DESKTOP_MEDIA_QUERY } from "./navigation/media-query.js";
import { useMediaQuery } from "./navigation/use-media-query.js";

export default function AppLayout() {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavigation onLogout={() => void handleLogout()} />
      <div className={isDesktop ? undefined : "pb-16"}>
        <Outlet />
      </div>
    </div>
  );
}
