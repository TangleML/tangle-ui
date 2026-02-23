import { createBrowserHistory, createHashHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { ErrorPage } from "@/components/shared/ErrorPage";
import { AuthorizationResultScreen as GitHubAuthorizationResultScreen } from "@/components/shared/GitHubAuth/AuthorizationResultScreen";
import { AuthorizationResultScreen as HuggingFaceAuthorizationResultScreen } from "@/components/shared/HuggingFaceAuth/AuthorizationResultScreen";
import { BASE_URL, IS_GITHUB_PAGES } from "@/utils/constants";

import RootLayout from "../components/layout/RootLayout";
import Editor from "./Editor";
import Home from "./Home";
import NotFoundPage from "./NotFoundPage";
import PipelineRun from "./PipelineRun";
import { QuickStartPage } from "./QuickStart";
import { SettingsPage } from "./Settings";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export const EDITOR_PATH = "/editor";
export const RUNS_BASE_PATH = "/runs";
export const QUICK_START_PATH = "/quick-start";
export const SETTINGS_PATH = "/settings";
export const APP_ROUTES = {
  HOME: "/",
  QUICK_START: QUICK_START_PATH,
  PIPELINE_EDITOR: `${EDITOR_PATH}/$name`,
  RUN_DETAIL: `${RUNS_BASE_PATH}/$id`,
  RUN_DETAIL_WITH_SUBGRAPH: `${RUNS_BASE_PATH}/$id/$subgraphExecutionId`,
  RUNS: RUNS_BASE_PATH,
  SETTINGS: `${SETTINGS_PATH}/$section`,
  GITHUB_AUTH_CALLBACK: "/authorize/github",
  HUGGINGFACE_AUTH_CALLBACK: "/authorize/huggingface",
};

const rootRoute = createRootRoute({
  component: Outlet,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
});

const mainLayout = createRoute({
  id: "main-layout",
  getParentRoute: () => rootRoute,
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.HOME,
  component: Home,
});

const quickStartRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.QUICK_START,
  component: QuickStartPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.SETTINGS,
  component: SettingsPage,
});

const editorRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.PIPELINE_EDITOR,
  component: Editor,
  beforeLoad: ({ search }) => {
    const name = (search as { name?: string }).name || "";
    return { name };
  },
});

const githubAuthCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: APP_ROUTES.GITHUB_AUTH_CALLBACK,
  component: GitHubAuthorizationResultScreen,
});

const huggingFaceAuthCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: APP_ROUTES.HUGGINGFACE_AUTH_CALLBACK,
  component: HuggingFaceAuthorizationResultScreen,
});

const runDetailRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.RUN_DETAIL,
  component: PipelineRun,
});

const runDetailWithSubgraphRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.RUN_DETAIL_WITH_SUBGRAPH,
  component: PipelineRun,
});

const appRouteTree = mainLayout.addChildren([
  indexRoute,
  quickStartRoute,
  settingsRoute,
  editorRoute,
  runDetailRoute,
  runDetailWithSubgraphRoute,
]);

const rootRouteTree = rootRoute.addChildren([
  githubAuthCallbackRoute,
  huggingFaceAuthCallbackRoute,
  appRouteTree,
]);

const basepath = BASE_URL.replace(/\/$/, "") || "";

// Use hash history for GitHub Pages to avoid 404s on refresh
// Hash routing uses # in URLs (e.g., /pipeline-studio-app/#/editor/my-pipeline)
// For standard deployment, use browser history with basepath
const history = IS_GITHUB_PAGES ? createHashHistory() : createBrowserHistory();

export const router = createRouter({
  routeTree: rootRouteTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  history,
  basepath: IS_GITHUB_PAGES ? "" : basepath, // Hash history doesn't need basepath
});

if (import.meta.env.VITE_HUGGING_FACE_AUTHORIZATION === "true") {
  /**
   * Sync state from the parent window to the child window in HuggingFace embedding
   * @see https://huggingface.co/docs/hub/en/spaces-handle-url-parameters
   * @todo: think about making this as a plugin
   */
  function emitLocationChange() {
    window.parent.postMessage(
      {
        queryString: window.location.search,
        hash: window.location.hash,
      },
      "https://huggingface.co",
    );
  }

  router.subscribe("onRendered", emitLocationChange);
}
