import { Outlet, useLocation } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ToastContainer } from "react-toastify";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BackendProvider } from "@/providers/BackendProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";

import AppFooter from "./AppFooter";
import AppMenu from "./AppMenu";

const RootLayout = () => {
  useDocumentTitle();
  const { pathname } = useLocation();
  // Dashboard routes handle their own footer in the sidebar.
  // Only show AppFooter on non-dashboard routes (editor, runs, settings, etc.)
  const isDashboard =
    pathname === "/" ||
    pathname.startsWith("/runs") ||
    pathname.startsWith("/pipelines") ||
    pathname.startsWith("/components") ||
    pathname.startsWith("/favorites") ||
    pathname.startsWith("/recently-viewed");

  return (
    <BackendProvider>
      <ComponentSpecProvider>
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
      </ComponentSpecProvider>
    </BackendProvider>
  );
};

export default RootLayout;
