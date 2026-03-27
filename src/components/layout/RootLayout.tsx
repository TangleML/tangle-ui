import { Outlet, useLocation } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ToastContainer } from "react-toastify";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BackendProvider } from "@/providers/BackendProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { PipelineStorageProvider } from "@/services/pipelineStorage/PipelineStorageProvider";

import AppFooter from "./AppFooter";
import AppMenu from "./AppMenu";

const DASHBOARD_PATHS = new Set([
  "/",
  "/runs",
  "/pipelines",
  "/components",
  "/favorites",
  "/recently-viewed",
]);

const RootLayout = () => {
  useDocumentTitle();
  const { pathname } = useLocation();
  const isDashboard =
    isFlagEnabled("dashboard") && DASHBOARD_PATHS.has(pathname);

  return (
    <BackendProvider>
      <ComponentSpecProvider>
        <PipelineStorageProvider>
          <ToastContainer />

          <div className="App flex flex-col min-h-screen w-full">
            <AppMenu />

            <main className="flex-1 grid">
              <Outlet />
            </main>

            {!isDashboard && <AppFooter />}

            {import.meta.env.VITE_ENABLE_ROUTER_DEVTOOLS === "true" && (
              <TanStackRouterDevtools />
            )}
          </div>
        </PipelineStorageProvider>
      </ComponentSpecProvider>
    </BackendProvider>
  );
};

export default RootLayout;
