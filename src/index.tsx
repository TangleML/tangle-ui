import "./styles/global.css";
import "@xyflow/react/dist/style.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { scan } from "react-scan";

import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { env } from "@/schemas/env";

import { router } from "./routes/router";
import { initializeBugsnag } from "./services/errorManagement/bugsnag";

initializeBugsnag();

const queryClient = new QueryClient();

scan({
  enabled: env.VITE_ENABLE_SCAN,
});

setBaseUrl();

const rootElement = document.getElementById("app")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

function setBaseUrl() {
  const base = document.createElement("base");
  base.setAttribute("href", env.VITE_BASE_URL);
  document.head.insertBefore(base, document.head.firstChild);
}
