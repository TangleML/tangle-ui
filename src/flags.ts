import type { ConfigFlags } from "@/types/configuration";

// Vite inlines `import.meta.env.VITE_*` only at a literal access like this one,
// and every value arrives as a string — so compare against "true" rather than
// testing truthiness, under which "false" would enable the flag. The guard is
// for Playwright, which loads this module through its own transform rather
// than Vite, leaving `import.meta.env` undefined and the literal access a
// TypeError that takes down the whole e2e run at collection time.
const isTangentEnabled =
  typeof import.meta.env !== "undefined" &&
  import.meta.env.VITE_ENABLE_TANGENT === "true";

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

  ["input-aggregator"]: {
    name: "Input Aggregator Component",
    description:
      "Enable the Input Aggregator component that supports multiple dynamic inputs and configurable output types (Array, Object, CSV).",
    default: false,
    category: "beta",
  },

  ["v2_editor"]: {
    name: "V2 Editor and Run View",
    description:
      "Enable the V2 editor and run view. You can switch between the V1 and V2 experiences.",
    default: true,
    category: "beta",
  },

  ["ai-assistant"]: {
    name: "AI Assistant",
    description:
      "Enable the AI Assistant panel in the V2 editor. Lets you chat with an assistant about your pipeline.",
    default: false,
    category: "beta",
  },

  ["tangent-shell"]: {
    name: "Tangent",
    description: "Agentic Tangle - coming soon!",
    default: false,
    category: "beta",
    canEnable: isTangentEnabled,
  },

  ["component-search-v2"]: {
    name: "Component Search",
    description:
      "Show the experimental component search that searches across standard, published, registered, and user component sources, with optional AI rerank.",
    default: true,
    category: "beta",
  },

  ["component-search-v2-ai-descriptions"]: {
    name: "Auto-generate component search AI descriptions",
    description:
      "Automatically generate an AI description when viewing a component in component search.",
    default: false,
    category: "setting",
    dependsOn: "component-search-v2",
  },

  ["compare-runs"]: {
    name: "Compare runs",
    description:
      "Select two runs to compare their pipeline structure and results side by side.",
    default: true,
    category: "beta",
  },

  ["projects"]: {
    name: "Projects",
    description:
      "Enable the Projects dashboard for grouping pipelines, agent sessions, and documents.",
    default: false,
    category: "beta",
  },

  ["conditional-execution"]: {
    name: "Conditional task execution",
    description:
      'Adds a "Conditional execution" setting to the task Config tab. A conditional task gains a "Run when" port that decides whether it runs, either from a literal or from an upstream value.',
    default: true,
    category: "beta",
  },
};
