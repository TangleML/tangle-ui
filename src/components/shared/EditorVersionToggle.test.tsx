import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_ROUTES } from "@/routes/appRoutes";

import { EditorVersionToggle } from "./EditorVersionToggle";

vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => true,
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderToggle(initialEntry: string) {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const rootRoute = createRootRoute();
  const legacyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.PIPELINE_EDITOR,
    component: EditorVersionToggle,
  });
  const v2Route = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.EDITOR_V2_PIPELINE,
    component: EditorVersionToggle,
  });
  const remoteLegacyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
    component: EditorVersionToggle,
  });
  const remoteV2Route = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
    component: EditorVersionToggle,
  });
  const history = createMemoryHistory({ initialEntries: [initialEntry] });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      legacyRoute,
      v2Route,
      remoteLegacyRoute,
      remoteV2Route,
    ]),
    history,
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return {
    router,
    user: userEvent.setup(),
    searchParams: () =>
      new URL(history.location.href, "http://localhost").searchParams,
  };
}

describe("EditorVersionToggle", () => {
  it.each([
    {
      label: "remote pipeline ID",
      suffix: "remote/pipeline-1",
      legacyRoute: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
      v2Route: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
    },
    {
      label: "local pipeline name",
      suffix: "Local%20pipeline",
      legacyRoute: APP_ROUTES.PIPELINE_EDITOR,
      v2Route: APP_ROUTES.EDITOR_V2_PIPELINE,
    },
    {
      label: "local pipeline named remote",
      suffix: "remote",
      legacyRoute: APP_ROUTES.PIPELINE_EDITOR,
      v2Route: APP_ROUTES.EDITOR_V2_PIPELINE,
    },
  ])(
    "preserves the $label route in both editor versions",
    async ({ suffix, legacyRoute, v2Route }) => {
      const { user, router, searchParams } = await renderToggle(
        `/editor-v2/${suffix}`,
      );
      expect(router.state.matches.at(-1)?.routeId).toBe(v2Route);

      await user.click(
        screen.getByRole("button", { name: "Switch to legacy editor" }),
      );
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          `/editor/${decodeURIComponent(suffix)}`,
        );
      });
      expect(router.state.matches.at(-1)?.routeId).toBe(legacyRoute);
      expect(searchParams().get("source")).toBeNull();

      await user.click(
        screen.getByRole("button", { name: "Switch to new editor" }),
      );
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          `/editor-v2/${decodeURIComponent(suffix)}`,
        );
      });
      expect(router.state.matches.at(-1)?.routeId).toBe(v2Route);
      expect(searchParams().get("source")).toBeNull();
    },
  );
});
