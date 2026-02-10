import type { ConfigFlags } from "@/types/configuration";

const isRemoteComponentLibraryEnabled =
  import.meta.env.VITE_DEFAULT_REMOTE_COMPONENT_LIBRARY_BETA === "true";

export const ExistingFlags: ConfigFlags = {
  ["highlight-node-on-component-hover"]: {
    name: "Highlight tasks on component hover",
    description:
      "Highlight the tasks on the Pipeline canvas when the component is hovered over in the component library.",
    default: false,
    category: "beta",
  },

  ["remote-component-library-search"]: {
    name: "Published Components Library",
    description: "Enable the Published Components Library feature.",
    default: isRemoteComponentLibraryEnabled,
    category: "beta",
  },

  ["github-component-library"]: {
    name: "GitHub Component Library",
    description:
      "Enable the GitHub Component Library. All lib folders will be based on GitHub components",
    default: false,
    category: "beta",
  },

  ["redirect-on-new-pipeline-run"]: {
    name: "Redirect on new pipeline run",
    description: "Automatically open a new tab after starting a new execution.",
    default: false,
    category: "setting",
  },

  ["created-by-me-default"]: {
    name: "Default created by me filter",
    description:
      "Automatically select the 'Created by me' filter when viewing the pipeline run list.",
    default: false,
    category: "setting",
  },

  ["dashboard-show-recently-opened"]: {
    name: "Show recently opened section",
    description: "Show recently opened runs and pipelines on the dashboard.",
    default: false,
    category: "setting",
  },

  ["dashboard-show-pinned"]: {
    name: "Show pinned section",
    description: "Show pinned runs and pipelines on the dashboard.",
    default: false,
    category: "setting",
  },

  ["in-app-component-editor"]: {
    name: "In-app component editor",
    description:
      "Enable the in-app component editor for creating and editing pipeline components.",
    default: true,
    category: "beta",
  },

  ["partial-selection"]: {
    name: "Partial Node Selection",
    description:
      "Allow nodes to be selected when partially covered by the selection box. Use Shift+drag for full selection, or Shift+Cmd+drag (Shift+Ctrl on Windows) for partial selection.",
    default: false,
    category: "beta",
  },

  ["templatized-pipeline-run-name"]: {
    name: "Templatized pipeline run name",
    description:
      "Enable the templatized pipeline run name feature. This will generate a run name for each pipeline run based on the template with placeholders.",
    default: false,
    category: "beta",
  },

  ["pipeline-run-filters-bar"]: {
    name: "Pipeline run filters bar (UI only)",
    description:
      "Non-functional UI preview. This filter bar is not connected to the API and is for testing/development purposes only.",
    default: false,
    category: "beta",
  },

  ["command-center-dashboard"]: {
    name: "Command Center Dashboard",
    description:
      "Replace the default homepage with a unified command center dashboard showing runs, pipelines, components, and quick actions at a glance.",
    default: false,
    category: "beta",
  },
};
