import "./styles/global.css";
import "@xyflow/react/dist/style.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { scan } from "react-scan";

import { startAgentTraceLog } from "@/agent/middleware/agentTraceLog";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { isTangentEnabled } from "@/components/shared/Settings/useFlags";
import { ThemeProvider } from "@/providers/ThemeProvider";

import { router } from "./routes/router";
import { initializeBugsnag } from "./services/errorManagement/bugsnag";

initializeBugsnag();

// Only Tangent has anything that broadcasts, and only Tangent can read it back.
if (isTangentEnabled()) {
  startAgentTraceLog();
}

const queryClient = new QueryClient();

scan({
  enabled: import.meta.env.VITE_ENABLE_SCAN === "true",
});

setBaseUrl();

const rootElement = document.getElementById("app")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </StrictMode>,
  );
}

function setBaseUrl() {
  const base = document.createElement("base");
  base.setAttribute("href", import.meta.env.VITE_BASE_URL ?? "/");
  document.head.insertBefore(base, document.head.firstChild);
}
