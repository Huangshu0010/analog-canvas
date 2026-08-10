import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Editor root element is missing");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    // Keep the worker inside Vite's base path so a repository Pages deployment
    // never installs a root-origin worker belonging to another site.
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  } else {
    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return;
        const wasControlled = navigator.serviceWorker.controller !== null;
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
        if (wasControlled) window.location.reload();
      });
  }
}
