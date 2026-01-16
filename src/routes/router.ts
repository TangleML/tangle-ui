import { createBrowserHistory, createHashHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { AuthorizationResultScreen as GitHubAuthorizationResultScreen } from "@/components/shared/GitHubAuth/AuthorizationResultScreen";
import { AuthorizationResultScreen as HuggingFaceAuthorizationResultScreen } from "@/components/shared/HuggingFaceAuth/AuthorizationResultScreen";
import { BASE_URL, IS_GITHUB_PAGES } from "@/utils/constants";

import RootLayout from "../components/layout/RootLayout";
import Compare from "./Compare";
import Editor from "./Editor";
import ErrorPage from "./ErrorPage";
import Home from "./Home";
import NotFoundPage from "./NotFoundPage";
import PipelineRun from "./PipelineRun";
import { QuickStartPage } from "./QuickStart";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export const EDITOR_PATH = "/editor";
export const RUNS_BASE_PATH = "/runs";
export const QUICK_START_PATH = "/quick-start";
export const COMPARE_PATH = "/compare";
export const APP_ROUTES = {
  HOME: "/",
  QUICK_START: QUICK_START_PATH,
  PIPELINE_EDITOR: `${EDITOR_PATH}/$name`,
  RUN_DETAIL: `${RUNS_BASE_PATH}/$id`,
  RUN_DETAIL_WITH_SUBGRAPH: `${RUNS_BASE_PATH}/$id/$subgraphExecutionId`,
  RUNS: RUNS_BASE_PATH,
  COMPARE: COMPARE_PATH,
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

/**
 * Search params for the home/index route.
 * - page_token: Pagination token for runs list
 * - filter: Filter string for runs (e.g., "created_by:me")
 */
export type HomeSearchParams = {
  page_token?: string;
  filter?: string;
};

const indexRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.HOME,
  component: Home,
  validateSearch: (search: Record<string, unknown>): HomeSearchParams => ({
    page_token:
      typeof search.page_token === "string" ? search.page_token : undefined,
    filter: typeof search.filter === "string" ? search.filter : undefined,
  }),
});

const quickStartRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.QUICK_START,
  component: QuickStartPage,
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

/**
 * Search params for the compare route.
 * - runs: Comma-separated list of run IDs to compare
 * - pipeline: Optional pipeline name to pre-select in the selector
 */
export type CompareSearchParams = {
  runs?: string;
  pipeline?: string;
};

const compareRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.COMPARE,
  component: Compare,
  validateSearch: (search: Record<string, unknown>): CompareSearchParams => ({
    runs: typeof search.runs === "string" ? search.runs : undefined,
    pipeline: typeof search.pipeline === "string" ? search.pipeline : undefined,
  }),
});

const appRouteTree = mainLayout.addChildren([
  indexRoute,
  quickStartRoute,
  editorRoute,
  runDetailRoute,
  runDetailWithSubgraphRoute,
  compareRoute,
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
