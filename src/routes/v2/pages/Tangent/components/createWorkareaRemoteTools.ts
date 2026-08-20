import type { RemoteToolMap } from "@tangent/remote-subagent";

import type { WorkareaTab } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { isRecord } from "@/utils/typeGuards";

/** Live handles into the workarea the remote tools drive. */
export interface WorkareaToolDeps {
  openTarget: (target: string, title?: string) => Promise<WorkareaTab>;
  getTabs: () => WorkareaTab[];
  closeTab: (id: string) => void;
  /** The remote-env id a pipeline tab's editor agent connected with, if any. */
  getEnvironmentId: (tabId: string) => string | undefined;
  /** Resolve once a pipeline tab's editor agent connects, or `undefined`. */
  waitForEnvironment: (tabId: string) => Promise<string | undefined>;
}

interface WorkareaTabSummary {
  id: string;
  kind: WorkareaTab["kind"];
  title: string;
  /**
   * For pipeline tabs, the remote-env id to spawn an editor sub-agent into so
   * it drives *this* pipeline. Absent until the tab's editor agent connects.
   */
  environmentId?: string;
  /** Whether the tab's editor agent is connected and ready to receive spawns. */
  ready?: boolean;
}

function summarize(
  tab: WorkareaTab,
  environmentId?: string,
): WorkareaTabSummary {
  const base = { id: tab.id, kind: tab.kind, title: tab.title };
  if (tab.kind !== "pipeline") return base;
  return { ...base, environmentId, ready: environmentId != null };
}

/**
 * Builds the remote tool catalog that lets a Tangent agent open and manage
 * pipelines in the project's Dynamic Workarea. `getDeps` is read on each call so
 * the tools always act on the current workarea state.
 */
export function createWorkareaRemoteTools(
  getDeps: () => WorkareaToolDeps,
): RemoteToolMap {
  return {
    open_pipeline: {
      description:
        "Open a pipeline in the project's Dynamic Workarea. `target` may be a " +
        "`pipeline://<fileId>` draft URI, a run URL or `run:<id>` (cloned into " +
        "a new editable draft), or a pipeline name. Returns the tab's " +
        "`environmentId`: to edit this pipeline, spawn an editor sub-agent into " +
        "that environment (its CSOM tools drive this exact pipeline). Do not " +
        "use the workarea tools to edit pipeline contents.",
      inputSchema: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description:
              "A `pipeline://<fileId>` URI, a run URL / `run:<id>`, or a pipeline name.",
          },
          title: {
            type: "string",
            description: "Optional tab title; defaults to the resolved name.",
          },
        },
        required: ["target"],
      },
      execute: async (args) => {
        if (!isRecord(args) || typeof args.target !== "string") {
          throw new Error("`target` is required and must be a string.");
        }
        const title = typeof args.title === "string" ? args.title : undefined;
        const tab = await getDeps().openTarget(args.target, title);
        if (tab.kind !== "pipeline") return summarize(tab);
        const environmentId = await getDeps().waitForEnvironment(tab.id);
        return summarize(tab, environmentId);
      },
    },
    list_workarea_tabs: {
      description:
        "List the tabs currently open in the Dynamic Workarea. Each pipeline " +
        "tab includes the `environmentId` to spawn an editor sub-agent into.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const deps = getDeps();
        return deps
          .getTabs()
          .map((tab) => summarize(tab, deps.getEnvironmentId(tab.id)));
      },
    },
    close_workarea_tab: {
      description: "Close a tab in the Dynamic Workarea by its id.",
      inputSchema: {
        type: "object",
        properties: {
          tabId: { type: "string", description: "The id of the tab to close." },
        },
        required: ["tabId"],
      },
      execute: (args) => {
        if (!isRecord(args) || typeof args.tabId !== "string") {
          throw new Error("`tabId` is required and must be a string.");
        }
        getDeps().closeTab(args.tabId);
        return { ok: true };
      },
    },
  };
}
