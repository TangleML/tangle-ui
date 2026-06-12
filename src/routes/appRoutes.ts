export const EDITOR_PATH = "/editor";
export const RUNS_BASE_PATH = "/runs";
const LEARN_BASE_PATH = "/learn";
const EDITOR_V2_BASE_PATH = "/editor-v2";
const RUNS_V2_BASE_PATH = "/runs-v2";
const SETTINGS_PATH = "/settings";
const IMPORT_PATH = "/app/editor/import-pipeline";

export const APP_ROUTES = {
  HOME: "/",
  DASHBOARD: "/",
  DASHBOARD_RUNS: "/runs",
  DASHBOARD_PIPELINES: "/pipelines",
  DASHBOARD_COMPONENTS: "/components",
  DASHBOARD_COMPONENTS_V2: "/components-v2",
  DASHBOARD_FAVORITES: "/favorites",
  DASHBOARD_RECENTLY_VIEWED: "/recently-viewed",
  LEARN: LEARN_BASE_PATH,
  LEARN_EXAMPLES: `${LEARN_BASE_PATH}/examples`,
  LEARN_TIPS: `${LEARN_BASE_PATH}/tips`,
  LEARN_TOURS: `${LEARN_BASE_PATH}/tours`,
  IMPORT: IMPORT_PATH,
  PIPELINE_EDITOR: `${EDITOR_PATH}/$name`,
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
  EDITOR_V2: EDITOR_V2_BASE_PATH,
  EDITOR_V2_PIPELINE: `${EDITOR_V2_BASE_PATH}/$pipelineName`,
  RUNS_V2: RUNS_V2_BASE_PATH,
  RUN_DETAIL_V2: `${RUNS_V2_BASE_PATH}/$id`,
  RUN_DETAIL_V2_WITH_SUBGRAPH: `${RUNS_V2_BASE_PATH}/$id/$subgraphExecutionId`,
  PIPELINE_FOLDERS: "/pipeline-folders",
  PLAYGROUND: "/playground",
  ARTIFACT_PREVIEW: "/artifact/$artifactId",
} as const;
