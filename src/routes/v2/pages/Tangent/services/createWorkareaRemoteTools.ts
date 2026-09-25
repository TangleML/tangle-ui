import type { RemoteToolMap } from "@tangent/remote-subagent";

import type { WorkareaTab } from "@/routes/v2/pages/Tangent/workarea/types";
import { isRecord } from "@/utils/typeGuards";

/** Live handles into the workarea the remote tools drive. */
export interface WorkareaToolDeps {
  openTarget: (target: string, title?: string) => Promise<WorkareaTab>;
  getTabs: () => WorkareaTab[];
  getActiveTabId: () => string | undefined;
  closeTab: (id: string) => void;
}

interface WorkareaTabSummary {
  id: string;
  kind: WorkareaTab["kind"];
  title: string;
  target: string;
  active: boolean;
}

function tabTarget(tab: WorkareaTab): string {
  if (tab.kind === "artifact") return tab.url;
  if (tab.kind === "run") return `run:${tab.runId}`;
  return tab.pipelineRef.fileId
    ? `pipeline://${tab.pipelineRef.fileId}`
    : tab.pipelineRef.name;
}

function summarize(
  tab: WorkareaTab,
  activeTabId: string | undefined,
): WorkareaTabSummary {
  return {
    id: tab.id,
    kind: tab.kind,
    title: tab.title,
    target: tabTarget(tab),
    active: tab.id === activeTabId,
  };
}

/**
 * The tab-management tools an agent uses to arrange the Dynamic Workarea: open
 * a resource, list open tabs, read the active tab, and close a tab. Summaries
 * are derived from workarea state alone — no live spec, `ToolBridgeApi`, or
 * sub-agent environment (those arrive with the remote agent in a later change).
 *
 * `getDeps` reads the live handles per call so a single catalog instance always
 * acts on the current tab state without rebuilding the socket connection.
 */
export function createWorkareaRemoteTools(
  getDeps: () => WorkareaToolDeps,
): RemoteToolMap {
  return {
    open_workarea_target: {
      description:
        "Open a target in the Dynamic Workarea and return the resulting tab. " +
        "The target is a `pipeline://<fileId>` URI, a `run:<id>` URI or run " +
        "URL, an artifact URL, or a pipeline name. Returns the tab summary " +
        "`{ id, kind, title, target, active }`.",
      inputSchema: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description:
              "A `pipeline://<fileId>` URI, a `run:<id>` URI or run URL, an " +
              "artifact URL, or a pipeline name.",
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
        return summarize(tab, tab.id);
      },
    },
    list_workarea_tabs: {
      description:
        "List the tabs currently open in the Dynamic Workarea, each as `{ id, " +
        "kind, title, target, active }`.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const deps = getDeps();
        const activeTabId = deps.getActiveTabId();
        return deps.getTabs().map((tab) => summarize(tab, activeTabId));
      },
    },
    get_active_workarea_tab: {
      description:
        "Return the active tab in the Dynamic Workarea as `{ id, kind, title, " +
        "target, active }`, or `null` when no tab is open.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const deps = getDeps();
        const activeTabId = deps.getActiveTabId();
        const active = deps.getTabs().find((tab) => tab.id === activeTabId);
        return active ? summarize(active, activeTabId) : null;
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
