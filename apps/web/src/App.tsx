import { useState } from "react";
import ClientsPage from "./ClientsPage.js";
import ProjectsPage from "./ProjectsPage.js";

type Page = "clients" | "projects";

export default function App() {
  const [page, setPage] = useState<Page>("clients");

  return (
    <div>
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl gap-1 px-8 py-3">
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
        </div>
      </nav>
      {page === "clients" ? <ClientsPage /> : <ProjectsPage />}
    </div>
  );
}
