import type { RemoteToolMap } from "@tangent/remote-subagent";

import type {
  WorkareaTab,
  WorkareaTarget,
  WorkareaViewKindName,
} from "@/routes/v2/pages/Tangent/workarea/types";
import {
  formatWorkareaTarget,
  parseWorkareaTarget,
} from "@/routes/v2/pages/Tangent/workarea/workareaTarget";
import { isRecord } from "@/utils/typeGuards";

/** Live handles into the workarea the remote tools drive. */
export interface WorkareaToolDeps {
  openTarget: (target: WorkareaTarget, title?: string) => Promise<WorkareaTab>;
  getTabs: () => WorkareaTab[];
  getActiveTabId: () => string | undefined;
  closeTab: (id: string) => void;
}

interface WorkareaTabSummary {
  id: string;
  kind: WorkareaViewKindName;
  title: string;
  target: string;
  active: boolean;
}

function summarize(
  tab: WorkareaTab,
  activeTabId: string | undefined,
): WorkareaTabSummary {
  return {
    id: tab.id,
    kind: tab.target.type,
    title: tab.title,
    target: formatWorkareaTarget(tab.target),
    active: tab.id === activeTabId,
  };
}

const TARGET_DESCRIPTION =
  "A `type://identity` target: `artifact://id/<url>`, " +
  "`pipeline://id/<fileId>`, `pipeline://name/<name>`, or `run://id/<runId>`.";

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
        `${TARGET_DESCRIPTION} Returns the tab summary ` +
        "`{ id, kind, title, target, active }`.",
      inputSchema: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: TARGET_DESCRIPTION,
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
        const target = parseWorkareaTarget(args.target);
        const tab = await getDeps().openTarget(target, title);
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
