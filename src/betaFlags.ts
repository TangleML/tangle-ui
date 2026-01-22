import type { BetaFlag } from "@/types/configuration";

const isRemoteComponentLibraryEnabled =
  import.meta.env.VITE_DEFAULT_REMOTE_COMPONENT_LIBRARY_BETA === "true";

export const ExistingBetaFlags = {
  ["highlight-node-on-component-hover"]: {
    name: "Highlight tasks on component hover",
    description:
      "Highlight the tasks on the Pipeline canvas when the component is hovered over in the component library.",
    default: false,
    category: "beta",
  } as BetaFlag,

  ["remote-component-library-search"]: {
    name: "Published Components Library",
    description: "Enable the Published Components Library feature.",
    default: isRemoteComponentLibraryEnabled,
    category: "beta",
  } as BetaFlag,

  ["github-component-library"]: {
    name: "GitHub Component Library",
    description:
      "Enable the GitHub Component Library. All lib folders will be based on GitHub components",
    default: false,
    category: "beta",
  } as BetaFlag,

  ["redirect-on-new-pipeline-run"]: {
    name: "Redirect on new pipeline run",
    description: "Automatically open a new tab after starting a new execution.",
    default: false,
    category: "setting",
  } as BetaFlag,

  ["created-by-me-default"]: {
    name: "Default created by me filter",
    description:
      "Automatically select the 'Created by me' filter when viewing the pipeline run list.",
    default: false,
    category: "setting",
  } as BetaFlag,

  ["in-app-component-editor"]: {
    name: "In-app component editor",
    description:
      "Enable the in-app component editor for creating and editing pipeline components.",
    default: true,
    category: "beta",
  } as BetaFlag,

  ["partial-selection"]: {
    name: "Partial Node Selection",
    description:
      "Allow nodes to be selected when partially covered by the selection box. Use Shift+drag for full selection, or Shift+Cmd+drag (Shift+Ctrl on Windows) for partial selection.",
    default: false,
    category: "beta",
  } as BetaFlag,
};
