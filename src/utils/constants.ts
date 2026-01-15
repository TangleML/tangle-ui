/* Environment Config */
export const ABOUT_URL =
  import.meta.env.VITE_ABOUT_URL || "https://tangleml.com/";

export const GIVE_FEEDBACK_URL =
  import.meta.env.VITE_GIVE_FEEDBACK_URL ||
  "https://github.com/TangleML/tangle/issues";

export const PRIVACY_POLICY_URL =
  import.meta.env.VITE_PRIVACY_POLICY_URL ||
  "https://tangleml.com/docs/privacy_policy/";

export const API_URL = import.meta.env.VITE_BACKEND_API_URL || "";
export const BASE_URL = import.meta.env.VITE_BASE_URL || "/";
export const IS_GITHUB_PAGES = import.meta.env.VITE_GITHUB_PAGES === "true";

export const GIT_REPO_URL =
  import.meta.env.VITE_GIT_REPO_URL || "https://github.com/TangleML/tangle-ui";

export const GIT_COMMIT = import.meta.env.VITE_GIT_COMMIT || "master";

export const USER_PIPELINES_LIST_NAME = "user_pipelines";

export const defaultPipelineYamlWithName = (name: string) => `
name: ${name}
metadata:
  annotations:
    sdk: https://cloud-pipelines.net/pipeline-editor/
    editor.flow-direction: left-to-right
implementation:
  graph:
    tasks: {}
    outputValues: {}
`;

// IndexedDB constants
export const DB_NAME = "components";
export const PIPELINE_RUNS_STORE_NAME = "pipeline_runs";

export const USER_COMPONENTS_LIST_NAME = "user_components";

export const TOP_NAV_HEIGHT = 56; // px
export const BOTTOM_FOOTER_HEIGHT = 30; // px

export const DEFAULT_NODE_DIMENSIONS = { w: 300, h: undefined };

export enum ComponentSearchFilter {
  NAME = "Name",
  INPUTNAME = "Input Name",
  INPUTTYPE = "Input Type",
  OUTPUTNAME = "Output Name",
  OUTPUTTYPE = "Output Type",
  EXACTMATCH = "Exact Match",
}

export const COMPONENT_SEARCH_FILTERS = Object.values(ComponentSearchFilter);

export const DEFAULT_FILTERS = [ComponentSearchFilter.NAME];

export const AUTOSAVE_DEBOUNCE_TIME_MS = 2000;

export const KEYBOARD_SHORTCUTS = {
  UNDO: "z",
  REDO: "y",
  MAC_META: "⌘",
  WINDOWS_META: "Ctrl",
} as const;

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
