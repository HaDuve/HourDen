import { Navigate, type RouteObject } from "react-router-dom";
import AppLayout from "./App.js";
import AuthenticatedApp from "./AuthenticatedApp.js";
import ClientsPage from "./ClientsPage.js";
import ImportPage from "./ImportPage.js";
import InvoicesPage from "./InvoicesPage.js";
import LoginPage from "./LoginPage.js";
import ProjectsPage from "./ProjectsPage.js";
import ReportPage from "./ReportPage.js";
import TodayPage from "./TodayPage.js";

export const appLayoutChildren: RouteObject[] = [
  { index: true, element: <TodayPage /> },
  { path: "today", element: <TodayPage /> },
  { path: "clients", element: <ClientsPage /> },
  { path: "projects", element: <ProjectsPage /> },
  { path: "report", element: <ReportPage /> },
  { path: "invoices", element: <InvoicesPage /> },
  { path: "import", element: <ImportPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];

export const authenticatedAppRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: appLayoutChildren,
  },
];

export const appRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <AuthenticatedApp />,
    children: authenticatedAppRoutes,
  },
];
