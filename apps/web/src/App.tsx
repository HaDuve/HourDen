import { Outlet } from "react-router-dom";

import { AppChrome } from "./chrome/AppChrome.js";
import { RemoteStopNoticeBanner } from "./chrome/RemoteStopNoticeBanner.js";

import AppNavigation from "./navigation/app-navigation.js";

import { DESKTOP_MEDIA_QUERY } from "./navigation/media-query.js";

import { useMediaQuery } from "./navigation/use-media-query.js";

import { RunningTimerProvider } from "./running-timer/RunningTimerProvider.js";



export default function AppLayout() {

  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);



  async function handleLogout() {

    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });

    window.location.href = "/login";

  }



  return (

    <RunningTimerProvider>

      <AppChrome />
      <RemoteStopNoticeBanner />

      <div className="flex min-h-screen flex-col bg-background">

        <AppNavigation isDesktop={isDesktop} onLogout={() => void handleLogout()} />

        <div className={isDesktop ? undefined : "pb-16"}>

          <Outlet />

        </div>

      </div>

    </RunningTimerProvider>

  );

}


