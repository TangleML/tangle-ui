import type { ConfigFlags } from "@/types/configuration";

export const ExistingFlags: ConfigFlags = {
  ["remote-component-library-search"]: {
    name: "Published Components Library",
    description: "Enable the Published Components Library feature.",
    default: true,
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

  ["templatized-pipeline-run-name"]: {
    name: "Templatized pipeline run name",
    description:
      "Enable the templatized pipeline run name feature. This will generate a run name for each pipeline run based on the template with placeholders.",
    default: false,
    category: "beta",
  },

  ["classic-node-style"]: {
    name: "Classic node style",
    description:
      "Use the classic visual style for task nodes in the editor. Inputs and outputs are shown as vertical sections instead of side-by-side columns.",
    default: false,
    category: "setting",
  },

  ["snap-properties-to-node"]: {
    name: "Position Properties near selected node",
    description:
      "When enabled, the floating Properties window is automatically positioned next to the selected node.",
    default: false,
    category: "setting",
  },

  ["task-component-ref-bar"]: {
    name: "Task Component Ref Bar",
    description:
      "When enabled, the Component Ref Bar is shown in the Task Details panel moving some of the actions to the Actions section.",
    default: true,
    category: "setting",
  },
};
