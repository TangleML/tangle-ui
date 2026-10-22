import { PROVISIONAL_NAME_ANNOTATION } from "./annotationKeys";
import type { ComponentSpec } from "./componentSpec";
import { componentSpecToYaml } from "./yaml";

/* Environment Config */
export const TANGLE_WEBSITE_URL = "https://tangleml.com/";

export const ABOUT_URL = import.meta.env.VITE_ABOUT_URL || TANGLE_WEBSITE_URL;

export const GIVE_FEEDBACK_URL =
  import.meta.env.VITE_GIVE_FEEDBACK_URL ||
  "https://github.com/TangleML/tangle/issues";

export const GITHUB_DISCUSSIONS_URL =
  import.meta.env.VITE_GITHUB_DISCUSSIONS_URL ||
  "https://github.com/TangleML/tangle/discussions";

export const PRIVACY_POLICY_URL =
  import.meta.env.VITE_PRIVACY_POLICY_URL ||
  "https://tangleml.com/docs/privacy_policy/";

export const DOCUMENTATION_URL =
  import.meta.env.VITE_DOCUMENTATION_URL || `${TANGLE_WEBSITE_URL}docs/`;

export const API_URL = import.meta.env.VITE_BACKEND_API_URL || "";
export const BASE_URL = import.meta.env.VITE_BASE_URL || "/";

export const USER_SETTINGS_PATH = "/api/users/me/settings";
export const IS_GITHUB_PAGES = import.meta.env.VITE_GITHUB_PAGES === "true";

export const GIT_REPO_URL =
  import.meta.env.VITE_GIT_REPO_URL || "https://github.com/TangleML/tangle-ui";

export const GIT_COMMIT = import.meta.env.VITE_GIT_COMMIT || "master";

export const ENABLE_GOOGLE_CLOUD_SUBMITTER =
  import.meta.env.VITE_ENABLE_GOOGLE_CLOUD_SUBMITTER === "true";

export const LAUNCHER_CAPABILITIES =
  import.meta.env.VITE_LAUNCHER_CAPABILITIES === "true";

export const defaultPipelineWithName = (
  name: string,
  { provisionalName = false } = {},
): ComponentSpec => ({
  name,
  metadata: {
    annotations: {
      sdk: "https://cloud-pipelines.net/pipeline-editor/",
      "editor.flow-direction": "left-to-right",
      ...(provisionalName ? { [PROVISIONAL_NAME_ANNOTATION]: "true" } : {}),
    },
  },
  implementation: { graph: { tasks: {}, outputValues: {} } },
});

export const defaultPipelineYamlWithName = (name: string, options = {}) =>
  componentSpecToYaml(defaultPipelineWithName(name, options));

// IndexedDB constants
export const DB_NAME = "components";
export const PIPELINE_RUNS_STORE_NAME = "pipeline_runs";

export const USER_COMPONENTS_LIST_NAME = "user_components";

export const TOP_NAV_HEIGHT = 56; // px

export const DEFAULT_NODE_DIMENSIONS = { w: 300, h: undefined };

export const FONT_SIZE_MD = 12;
export const FONT_SIZE_SM = 10;

export const AUTOSAVE_DEBOUNCE_TIME_MS = 300;

// Container exit codes
export const EXIT_CODE_OOM = 137; // SIGKILL (128 + 9) - Out of Memory

// Time constants
export const ONE_MINUTE_IN_MS = 60 * 1000;
export const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;

export const ROOT_TASK_ID = "root";

export const ISO8601_DURATION_ZERO_DAYS = "P0D";

export const DEFAULT_RATE_LIMIT_RPS = 10; // requests per second

export const MINUTES = 60 * 1000;
export const HOURS = 60 * MINUTES;
