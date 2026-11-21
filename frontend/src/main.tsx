import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./redesign.css";
import "./mobile-commerce.css";
import "./layouts/desktop-shell.css";
import "./layouts/mobile-shell.css";
import "./mobile/mobile-home.css";
import "./stride-district.css";
import { App } from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
