import "./styles/global.css";
import "@xyflow/react/dist/style.css";
import "./api/clientConfig";

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { scan } from "react-scan";

import { ErrorHandler } from "@/components/shared/ErrorHandler";
import { createQueryClient } from "@/config/queryClient";
import { setBaseUrl } from "@/utils/setBaseUrl";

import { BugsnagProvider } from "./providers/BugsnagProvider";
import { router } from "./routes/router";

const queryClient = createQueryClient();

scan({
  enabled: import.meta.env.VITE_ENABLE_SCAN === "true",
});

setBaseUrl();

const rootElement = document.getElementById("app")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <BugsnagProvider
        fallback={(props) => (
          <ErrorHandler
            error={props.error}
            errorType="app_error_boundary"
            resetErrorBoundary={props.resetErrorBoundary}
          />
        )}
      >
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </BugsnagProvider>
    </StrictMode>,
  );
}
