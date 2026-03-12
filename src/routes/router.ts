import { createBrowserHistory, createHashHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { ErrorPage } from "@/components/shared/ErrorPage";
import { AuthorizationResultScreen as GitHubAuthorizationResultScreen } from "@/components/shared/GitHubAuth/AuthorizationResultScreen";
import { AuthorizationResultScreen as HuggingFaceAuthorizationResultScreen } from "@/components/shared/HuggingFaceAuth/AuthorizationResultScreen";
import { AddSecretView } from "@/components/shared/SecretsManagement/components/AddSecretView";
import { ReplaceSecretView } from "@/components/shared/SecretsManagement/components/ReplaceSecretView";
import { SecretsListView } from "@/components/shared/SecretsManagement/components/SecretsListView";
import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { BASE_URL, IS_GITHUB_PAGES } from "@/utils/constants";

import RootLayout from "../components/layout/RootLayout";
import { Dashboard } from "./Dashboard/Dashboard";
import Editor from "./Editor";
import Home from "./Home";
import { ImportPage } from "./Import";
import NotFoundPage from "./NotFoundPage";
import PipelineRun from "./PipelineRun";
import { QuickStartPage } from "./QuickStart";
import { BackendSettings } from "./Settings/sections/BackendSettings";
import { BetaFeaturesSettings } from "./Settings/sections/BetaFeaturesSettings";
import { PreferencesSettings } from "./Settings/sections/PreferencesSettings";
import { SecretsSettings } from "./Settings/sections/SecretsSettings";
import { SettingsLayout } from "./Settings/SettingsLayout";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export const EDITOR_PATH = "/editor";
export const RUNS_BASE_PATH = "/runs";
export const QUICK_START_PATH = "/quick-start";
const SETTINGS_PATH = "/settings";
const IMPORT_PATH = "/app/editor/import-pipeline";
const DASHBOARD_PATH = "/dashboard";
export const APP_ROUTES = {
  HOME: "/",
  DASHBOARD: DASHBOARD_PATH,
  QUICK_START: QUICK_START_PATH,
  IMPORT: IMPORT_PATH,
  PIPELINE_EDITOR: `${EDITOR_PATH}/$name`,
  RUN_DETAIL: `${RUNS_BASE_PATH}/$id`,
  RUN_DETAIL_WITH_SUBGRAPH: `${RUNS_BASE_PATH}/$id/$subgraphExecutionId`,
  RUNS: RUNS_BASE_PATH,
  SETTINGS: SETTINGS_PATH,
  SETTINGS_BACKEND: `${SETTINGS_PATH}/backend`,
  SETTINGS_PREFERENCES: `${SETTINGS_PATH}/preferences`,
  SETTINGS_BETA_FEATURES: `${SETTINGS_PATH}/beta-features`,
  SETTINGS_SECRETS: `${SETTINGS_PATH}/secrets`,
  SETTINGS_SECRETS_ADD: `${SETTINGS_PATH}/secrets/add`,
  SETTINGS_SECRETS_REPLACE: `${SETTINGS_PATH}/secrets/$secretId/replace`,
  GITHUB_AUTH_CALLBACK: "/authorize/github",
  HUGGINGFACE_AUTH_CALLBACK: "/authorize/huggingface",
} as const;

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

const dashboardRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.DASHBOARD,
  component: Dashboard,
  beforeLoad: () => {
    if (!isFlagEnabled("dashboard")) {
      throw redirect({ to: APP_ROUTES.HOME });
    }
  },
});

const quickStartRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.QUICK_START,
  component: QuickStartPage,
});

const settingsLayoutRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: SETTINGS_PATH,
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: APP_ROUTES.SETTINGS_BACKEND });
  },
});

const settingsBackendRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/backend",
  component: BackendSettings,
});

const settingsPreferencesRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/preferences",
  component: PreferencesSettings,
});

const settingsBetaFeaturesRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/beta-features",
  component: BetaFeaturesSettings,
});

const settingsSecretsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/secrets",
  component: SecretsSettings,
});

const secretsIndexRoute = createRoute({
  getParentRoute: () => settingsSecretsRoute,
  path: "/",
  component: SecretsListView,
});

const secretsAddRoute = createRoute({
  getParentRoute: () => settingsSecretsRoute,
  path: "/add",
  component: AddSecretView,
});

const secretsReplaceRoute = createRoute({
  getParentRoute: () => settingsSecretsRoute,
  path: "/$secretId/replace",
  component: ReplaceSecretView,
});

const importRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.IMPORT,
  component: ImportPage,
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

const secretsRouteTree = settingsSecretsRoute.addChildren([
  secretsIndexRoute,
  secretsAddRoute,
  secretsReplaceRoute,
]);

const settingsRouteTree = settingsLayoutRoute.addChildren([
  settingsIndexRoute,
  settingsBackendRoute,
  settingsPreferencesRoute,
  settingsBetaFeaturesRoute,
  secretsRouteTree,
]);

const appRouteTree = mainLayout.addChildren([
  indexRoute,
  dashboardRoute,
  quickStartRoute,
  settingsRouteTree,
  importRoute,
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
