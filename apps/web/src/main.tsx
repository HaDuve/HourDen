import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./App.js";
import AuthenticatedApp from "./AuthenticatedApp.js";
import ClientsPage from "./ClientsPage.js";
import ImportPage from "./ImportPage.js";
import InvoicesPage from "./InvoicesPage.js";
import LoginPage from "./LoginPage.js";
import ProjectsPage from "./ProjectsPage.js";
import ReportPage from "./ReportPage.js";
import TodayPage from "./TodayPage.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthenticatedApp />}>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<TodayPage />} />
            <Route path="today" element={<TodayPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="import" element={<ImportPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
