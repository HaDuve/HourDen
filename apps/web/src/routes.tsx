import { Navigate, type RouteObject } from "react-router-dom";
import AppLayout from "./App.js";
import AuthenticatedApp from "./AuthenticatedApp.js";
import ClientsPage from "./ClientsPage.js";
import ImportPage from "./ImportPage.js";
import InvoicesPage from "./InvoicesPage.js";
import LoginPage from "./LoginPage.js";
import ClientStepPage from "./onboarding/ClientStepPage.js";
import InvoiceSenderStepPage from "./onboarding/InvoiceSenderStepPage.js";
import OnboardingGuard from "./onboarding/OnboardingGuard.js";
import OnboardingLayout from "./onboarding/OnboardingLayout.js";
import ProjectStepPage from "./onboarding/ProjectStepPage.js";
import ProjectsPage from "./ProjectsPage.js";
import DashboardPage from "./DashboardPage.js";
import ReportPage from "./ReportPage.js";
import TrackerPage from "./TrackerPage.js";

export const appLayoutChildren: RouteObject[] = [
  { index: true, element: <TrackerPage /> },
  { path: "tracker", element: <TrackerPage /> },
  { path: "today", element: <Navigate to="/tracker" replace /> },
  { path: "clients", element: <ClientsPage /> },
  { path: "projects", element: <ProjectsPage /> },
  { path: "dashboard", element: <DashboardPage /> },
  { path: "report", element: <ReportPage /> },
  { path: "invoices", element: <InvoicesPage /> },
  { path: "import", element: <ImportPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];

export const onboardingRoutes: RouteObject[] = [
  {
    path: "onboarding",
    element: <OnboardingLayout />,
    children: [
      { index: true, element: <Navigate to="client" replace /> },
      { path: "client", element: <ClientStepPage /> },
      { path: "project", element: <ProjectStepPage /> },
      { path: "invoice-sender", element: <InvoiceSenderStepPage /> },
    ],
  },
];

export const authenticatedAppRoutes: RouteObject[] = [
  {
    element: <OnboardingGuard />,
    children: [
      ...onboardingRoutes,
      {
        path: "/",
        element: <AppLayout />,
        children: appLayoutChildren,
      },
    ],
  },
];

export const appRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <AuthenticatedApp />,
    children: authenticatedAppRoutes,
  },
];
