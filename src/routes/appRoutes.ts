export const EDITOR_PATH = "/editor";
export const RUNS_BASE_PATH = "/runs";
const LEARN_BASE_PATH = "/learn";
const SETTINGS_PATH = "/settings";
const IMPORT_PATH = "/app/editor/import-pipeline";
const TOUR_BASE_PATH = "/tour";
const TANGENT_BASE_PATH = "/tangent";
const PROJECTS_BASE_PATH = "/projects";

export const APP_ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  WELCOME: "/welcome",
  DASHBOARD_RUNS: "/runs",
  DASHBOARD_PIPELINES: "/pipelines",
  DASHBOARD_COMPONENTS: "/components",
  DASHBOARD_FAVORITES: "/favorites",
  DASHBOARD_RECENTLY_VIEWED: "/recently-viewed",
  PROJECTS: PROJECTS_BASE_PATH,
  PROJECT_DETAIL: `${PROJECTS_BASE_PATH}/$projectId`,
  LEARN: LEARN_BASE_PATH,
  LEARN_EXAMPLES: `${LEARN_BASE_PATH}/examples`,
  LEARN_TIPS: `${LEARN_BASE_PATH}/tips`,
  LEARN_TOURS: `${LEARN_BASE_PATH}/tours`,
  TOUR: TOUR_BASE_PATH,
  TOUR_DETAIL: `${TOUR_BASE_PATH}/$tourId`,
  IMPORT: IMPORT_PATH,
  EDITOR: EDITOR_PATH,
  NEW_PIPELINE: `${EDITOR_PATH}/new/pipeline`,
  REMOTE_PIPELINE_EDITOR: `${EDITOR_PATH}/pipeline/$pipelineId`,
  RUN_DETAIL: `${RUNS_BASE_PATH}/$id`,
  RUN_DETAIL_WITH_SUBGRAPH: `${RUNS_BASE_PATH}/$id/$subgraphExecutionId`,
  RUNS: RUNS_BASE_PATH,
  SETTINGS: SETTINGS_PATH,
  SETTINGS_BACKEND: `${SETTINGS_PATH}/backend`,
  SETTINGS_PREFERENCES: `${SETTINGS_PATH}/preferences`,
  SETTINGS_BETA_FEATURES: `${SETTINGS_PATH}/beta-features`,
  SETTINGS_AGENT: `${SETTINGS_PATH}/agent`,
  SETTINGS_SECRETS: `${SETTINGS_PATH}/secrets`,
  SETTINGS_SECRETS_ADD: `${SETTINGS_PATH}/secrets/add`,
  SETTINGS_SECRETS_REPLACE: `${SETTINGS_PATH}/secrets/$secretId/replace`,
  GITHUB_AUTH_CALLBACK: "/authorize/github",
  HUGGINGFACE_AUTH_CALLBACK: "/authorize/huggingface",
  TANGENT_PROJECT: `${TANGENT_BASE_PATH}/$projectId`,
  PLAYGROUND: "/playground",
  ARTIFACT_PREVIEW: "/artifact/$artifactId",
  EXECUTION_LOGS: "/logs/$executionId",
  COMPARE: "/compare",
} as const;
