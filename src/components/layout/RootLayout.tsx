import { Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ToastContainer } from "react-toastify";

import { useClickTracking } from "@/hooks/useClickTracking";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import { AnalyticsProvider } from "@/providers/AnalyticsProvider";
import { BackendProvider } from "@/providers/BackendProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { PipelineStorageProvider } from "@/services/pipelineStorage/PipelineStorageProvider";

import AppMenu from "./AppMenu";

function RootLayoutContent() {
  usePageViewTracking();
  useClickTracking();

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

            {import.meta.env.VITE_ENABLE_ROUTER_DEVTOOLS === "true" && (
              <TanStackRouterDevtools />
            )}
          </div>
        </PipelineStorageProvider>
      </ComponentSpecProvider>
    </BackendProvider>
  );
}

const RootLayout = () => {
  useDocumentTitle();
  return (
    <AnalyticsProvider>
      <RootLayoutContent />
    </AnalyticsProvider>
  );
};

export default RootLayout;
