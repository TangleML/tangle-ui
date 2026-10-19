import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_ROUTES } from "@/routes/appRoutes";

import { createLegacyRemoteEditorRoutes } from "./legacyRemoteEditorRoutes";

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function open(initialEntry: string) {
  const root = createRootRoute();
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: APP_ROUTES.DASHBOARD_PIPELINES,
    component: () => <p>Dashboard</p>,
  });
  const localEditor = createRoute({
    getParentRoute: () => root,
    path: APP_ROUTES.PIPELINE_EDITOR,
    component: () => <p>Local pipeline</p>,
  });
  const localEditorV2 = createRoute({
    getParentRoute: () => root,
    path: APP_ROUTES.EDITOR_V2_PIPELINE,
    component: () => <p>Local pipeline</p>,
  });
  const savedEditor = createRoute({
    getParentRoute: () => root,
    path: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
    component: () => <p>Saved pipeline</p>,
  });
  const savedEditorV2 = createRoute({
    getParentRoute: () => root,
    path: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
    component: () => <p>Saved pipeline</p>,
  });
  const history = createMemoryHistory({
    initialEntries: [APP_ROUTES.DASHBOARD_PIPELINES, initialEntry],
  });
  const router = createRouter({
    routeTree: root.addChildren([
      dashboard,
      localEditor,
      localEditorV2,
      savedEditor,
      savedEditorV2,
      ...createLegacyRemoteEditorRoutes(root),
    ]),
    history,
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return { router, history };
}

describe.each([
  {
    editor: "legacy editor",
    alias: APP_ROUTES.LEGACY_REMOTE_PIPELINE_EDITOR,
    target: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
    local: APP_ROUTES.PIPELINE_EDITOR,
    nameParam: "$name",
  },
  {
    editor: "V2 editor",
    alias: APP_ROUTES.LEGACY_EDITOR_V2_REMOTE_PIPELINE,
    target: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
    local: APP_ROUTES.EDITOR_V2_PIPELINE,
    nameParam: "$pipelineName",
  },
])("$editor compatibility links", ({ alias, target, local, nameParam }) => {
  it.each(["saved-id", "folder/pipeline with spaces?#"])(
    "redirects %s while preserving search, hash, and history",
    async (pipelineId) => {
      const encodedId = encodeURIComponent(pipelineId);
      const { router, history } = await open(
        `${alias.replace("$pipelineId", encodedId)}?projectId=project-1&view=graph#task-1`,
      );

      await screen.findByText("Saved pipeline");
      expect(history.location.pathname).toBe(
        target.replace("$pipelineId", encodedId),
      );
      expect(router.state.matches.at(-1)?.params).toMatchObject({ pipelineId });
      expect(router.state.location.search).toEqual({
        projectId: "project-1",
        view: "graph",
      });
      expect(history.location.hash).toBe("#task-1");
      expect(history.length).toBe(2);

      await act(async () => {
        history.back();
        await router.load();
      });
      await screen.findByText("Dashboard");
      expect(history.location.pathname).toBe(APP_ROUTES.DASHBOARD_PIPELINES);
    },
  );

  it.each(["remote", "pipeline"])(
    "keeps a local pipeline named %s on its existing route",
    async (name) => {
      const path = local.replace(nameParam, name);
      const { history } = await open(path);

      await screen.findByText("Local pipeline");
      expect(history.location.pathname).toBe(path);
      expect(history.length).toBe(2);
    },
  );
});
