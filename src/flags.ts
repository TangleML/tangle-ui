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

  ["input-aggregator"]: {
    name: "Input Aggregator Component",
    description:
      "Enable the Input Aggregator component that supports multiple dynamic inputs and configurable output types (Array, Object, CSV).",
    default: false,
    category: "beta",
  },

  ["dashboard"]: {
    name: "Dashboard",
    description:
      "Enable the new Dashboard page, a redesigned homepage experience.",
    default: true,
    category: "beta",
  },
};
