import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthenticatedApp from "./AuthenticatedApp.js";
import LoginPage from "./LoginPage.js";
import "./index.css";

const isLoginPage = window.location.pathname === "/login";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isLoginPage ? <LoginPage /> : <AuthenticatedApp />}
  </StrictMode>,
);
