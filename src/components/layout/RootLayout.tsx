import { Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ToastContainer } from "react-toastify";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BackendProvider } from "@/providers/BackendProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { env } from "@/schemas/env";

import AppFooter from "./AppFooter";
import AppMenu from "./AppMenu";

const RootLayout = () => {
  useDocumentTitle();

  return (
    <BackendProvider>
      <ComponentSpecProvider>
        <ToastContainer />

        <div className="App flex flex-col min-h-screen w-full">
          <AppMenu />

          <main className="flex-1 grid">
            <Outlet />
          </main>

          <AppFooter />

          {env.VITE_ENABLE_ROUTER_DEVTOOLS && <TanStackRouterDevtools />}
        </div>
      </ComponentSpecProvider>
    </BackendProvider>
  );
};

export default RootLayout;
