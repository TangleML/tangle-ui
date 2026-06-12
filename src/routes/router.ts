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

export { APP_ROUTES, EDITOR_PATH, RUNS_BASE_PATH } from "./appRoutes";
import RootLayout from "../components/layout/RootLayout";
import { APP_ROUTES } from "./appRoutes";
import { DashboardComponentsV2View } from "./Dashboard/DashboardComponentsV2View";
import { DashboardComponentsView } from "./Dashboard/DashboardComponentsView";
import { DashboardFavoritesView } from "./Dashboard/DashboardFavoritesView";
import { DashboardHomeView } from "./Dashboard/DashboardHomeView";
import { DashboardLayout } from "./Dashboard/DashboardLayout";
import { DashboardPipelinesView } from "./Dashboard/DashboardPipelinesView";
import { DashboardRecentlyViewedView } from "./Dashboard/DashboardRecentlyViewedView";
import { DashboardRunsView } from "./Dashboard/DashboardRunsView";
import { LearnExamplesView } from "./Dashboard/Learn/LearnExamplesView";
import { LearnHomeView } from "./Dashboard/Learn/LearnHomeView";
import { LearnTipsView } from "./Dashboard/Learn/LearnTipsView";
import { LearnToursView } from "./Dashboard/Learn/LearnToursView";
import Editor from "./Editor";
import { ImportPage } from "./Import";
import NotFoundPage from "./NotFoundPage";
import PipelineRun from "./PipelineRun";
import ArtifactPreviewPage from "./PipelineRun/ArtifactPreview";
import { AgentSettings } from "./Settings/sections/AgentSettings";
import { BackendSettings } from "./Settings/sections/BackendSettings";
import { BetaFeaturesSettings } from "./Settings/sections/BetaFeaturesSettings";
import { PreferencesSettings } from "./Settings/sections/PreferencesSettings";
import { SecretsSettings } from "./Settings/sections/SecretsSettings";
import { SettingsLayout } from "./Settings/SettingsLayout";
import { EditorV2 } from "./v2/pages/Editor/EditorV2";
import { PipelineFoldersPage } from "./v2/pages/PipelineFolders/PipelineFoldersPage";
import { RunViewV2 } from "./v2/pages/RunView/RunViewV2";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

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

// Dashboard is a pathless layout — its children resolve to top-level paths
// (/, /runs, /pipelines, etc.) without a /dashboard prefix.
const dashboardRoute = createRoute({
  id: "dashboard-layout",
  getParentRoute: () => mainLayout,
  component: DashboardLayout,
});

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/",
  component: DashboardHomeView,
});

const dashboardRunsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/runs",
  component: DashboardRunsView,
});

const dashboardPipelinesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/pipelines",
  component: DashboardPipelinesView,
});

const dashboardComponentsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/components",
  component: DashboardComponentsView,
  beforeLoad: () => {
    if (isFlagEnabled("component-search-v2")) {
      throw redirect({ to: APP_ROUTES.DASHBOARD_COMPONENTS_V2 });
    }
  },
});

const dashboardComponentsV2Route = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/components-v2",
  component: DashboardComponentsV2View,
  beforeLoad: () => {
    if (!isFlagEnabled("component-search-v2")) {
      throw redirect({ to: APP_ROUTES.DASHBOARD_COMPONENTS });
    }
  },
});

const dashboardFavoritesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/favorites",
  component: DashboardFavoritesView,
});

const dashboardRecentlyViewedRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/recently-viewed",
  component: DashboardRecentlyViewedView,
});

const learnIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: APP_ROUTES.LEARN,
  component: LearnHomeView,
});

const learnExamplesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: APP_ROUTES.LEARN_EXAMPLES,
  component: LearnExamplesView,
});

const learnTipsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: APP_ROUTES.LEARN_TIPS,
  component: LearnTipsView,
});

const learnToursRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: APP_ROUTES.LEARN_TOURS,
  component: LearnToursView,
});

const quickStartRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: "/quick-start",
  beforeLoad: () => {
    throw redirect({ to: APP_ROUTES.LEARN_EXAMPLES });
  },
});

const settingsLayoutRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.SETTINGS,
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

const settingsAgentRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/agent",
  component: AgentSettings,
  beforeLoad: () => {
    if (
      !isFlagEnabled("component-search-v2") &&
      !isFlagEnabled("ai-assistant")
    ) {
      throw redirect({ to: APP_ROUTES.SETTINGS_BACKEND });
    }
  },
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
  beforeLoad: ({ search }: { search: { name?: string } }) => {
    const name = search.name || "";
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
  settingsAgentRoute,
  secretsRouteTree,
]);

const editorV2Route = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.EDITOR_V2,
  component: EditorV2,
});

const editorV2PipelineRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.EDITOR_V2_PIPELINE,
  component: EditorV2,
});

const runV2Route = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.RUN_DETAIL_V2,
  component: RunViewV2,
});

const runV2WithSubgraphRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.RUN_DETAIL_V2_WITH_SUBGRAPH,
  component: RunViewV2,
});

const pipelineFoldersRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.PIPELINE_FOLDERS,
  component: PipelineFoldersPage,
});

const artifactPreviewRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.ARTIFACT_PREVIEW,
  component: ArtifactPreviewPage,
});

const dashboardRouteTree = dashboardRoute.addChildren([
  dashboardIndexRoute,
  dashboardRunsRoute,
  dashboardPipelinesRoute,
  dashboardComponentsRoute,
  dashboardComponentsV2Route,
  dashboardFavoritesRoute,
  dashboardRecentlyViewedRoute,
  learnIndexRoute,
  learnExamplesRoute,
  learnTipsRoute,
  learnToursRoute,
]);

const appRouteTree = mainLayout.addChildren([
  dashboardRouteTree,
  quickStartRoute,
  settingsRouteTree,
  importRoute,
  editorRoute,
  runDetailRoute,
  runDetailWithSubgraphRoute,
  editorV2Route,
  editorV2PipelineRoute,
  runV2Route,
  runV2WithSubgraphRoute,
  pipelineFoldersRoute,
  artifactPreviewRoute,
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
