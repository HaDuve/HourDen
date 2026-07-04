import { useState } from "react";
import ClientsPage from "./ClientsPage.js";
import ImportPage from "./ImportPage.js";
import ProjectsPage from "./ProjectsPage.js";
import InvoicesPage from "./InvoicesPage.js";
import ReportPage from "./ReportPage.js";
import TodayPage from "./TodayPage.js";

type Page = "today" | "clients" | "projects" | "report" | "invoices" | "import";

export default function App() {
  const [page, setPage] = useState<Page>("today");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  return (
    <div>
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-8 py-3">
          <div className="flex flex-1 gap-1">
          <button
            type="button"
            onClick={() => setPage("today")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              page === "today"
                ? "bg-slate-900 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setPage("clients")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              page === "clients"
                ? "bg-slate-900 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Clients
          </button>
          <button
            type="button"
            onClick={() => setPage("projects")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              page === "projects"
                ? "bg-slate-900 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => setPage("report")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              page === "report"
                ? "bg-slate-900 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Report
          </button>
          <button
            type="button"
            onClick={() => setPage("invoices")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              page === "invoices"
                ? "bg-slate-900 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Invoices
          </button>
          <button
            type="button"
            onClick={() => setPage("import")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              page === "import"
                ? "bg-slate-900 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Import
          </button>
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
      {page === "today" ? (
        <TodayPage />
      ) : page === "clients" ? (
        <ClientsPage />
      ) : page === "projects" ? (
        <ProjectsPage />
      ) : page === "report" ? (
        <ReportPage />
      ) : page === "invoices" ? (
        <InvoicesPage />
      ) : (
        <ImportPage />
      )}
    </div>
  );
}
