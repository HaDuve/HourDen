import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useRoutes } from "react-router-dom";
import { appRoutes } from "./routes.js";
import "./i18n/i18n.js";
import "./index.css";

function AppRouter() {
  return useRoutes(appRoutes);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </Suspense>
  </StrictMode>,
);
