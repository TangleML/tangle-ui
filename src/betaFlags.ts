import type { BetaFlag } from "@/types/betaFlags";

export const ExistingBetaFlags = {
  ["highlight-node-on-component-hover"]: {
    name: "Highlight tasks on component hover",
    description:
      "Highlight the tasks on the Pipeline canvas when the component is hovered over in the component library.",
    default: false,
  } as BetaFlag,

  ["remote-component-library-search"]: {
    name: "Published Components Library",
    description: "Enable the Published Components Library feature.",
    default: true,
  } as BetaFlag,

  ["redirect-on-new-pipeline-run"]: {
    name: "Redirect on new pipeline run",
    description: "Automatically open a new tab after starting a new execution.",
    default: false,
  } as BetaFlag,

  ["created-by-me-default"]: {
    name: "Default created by me filter",
    description:
      "Automatically select the 'Created by me' filter when viewing the pipeline run list.",
    default: false,
  } as BetaFlag,

  ["in-app-component-editor"]: {
    name: "In-app component editor",
    description:
      "Enable the in-app component editor for creating and editing pipeline components.",
    default: true,
  } as BetaFlag,

  ["subgraph-navigation"]: {
    name: "Subgraph Navigation",
    description:
      "⚠️ Experimental ⚠️ feature for viewing subgraphs. Navigate into nested pipeline components by double-clicking.",
    default: true,
  } as BetaFlag,

  ["partial-selection"]: {
    name: "Partial Node Selection",
    description:
      "Allow nodes to be selected when partially covered by the selection box. Use Shift+drag for full selection, or Shift+Cmd+drag (Shift+Ctrl on Windows) for partial selection.",
    default: false,
  } as BetaFlag,
};
