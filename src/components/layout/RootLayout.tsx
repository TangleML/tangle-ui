import { Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ToastContainer } from "react-toastify";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { AnalyticsProvider } from "@/providers/AnalyticsProvider";
import { BackendProvider } from "@/providers/BackendProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { PipelineStorageProvider } from "@/services/pipelineStorage/PipelineStorageProvider";

import AppMenu from "./AppMenu";

const RootLayout = () => {
  useDocumentTitle();
  return (
    <AnalyticsProvider>
      <BackendProvider>
        <ComponentSpecProvider>
          <PipelineStorageProvider>
            <ToastContainer />

            <div className="App flex flex-col min-h-screen w-full">
              <AppMenu />

              <main className="flex-1 grid">
                <Outlet />
              </main>

              {import.meta.env.VITE_ENABLE_ROUTER_DEVTOOLS === "true" && (
                <TanStackRouterDevtools />
              )}
            </div>
          </PipelineStorageProvider>
        </ComponentSpecProvider>
      </BackendProvider>
    </AnalyticsProvider>
  );
};

export default RootLayout;
