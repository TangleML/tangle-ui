import type { RemoteToolMap } from "@tangent/remote-subagent";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import {
  truncateContainerLog,
  truncateContainerState,
  truncateExecutionDetails,
} from "@/agent/util/truncate";
import type {
  WorkareaTab,
  WorkareaTarget,
  WorkareaViewKindName,
} from "@/routes/v2/pages/Tangent/workarea/types";
import {
  formatWorkareaTarget,
  idIdentity,
  nameIdentity,
  parseIdentity,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";
import { isRecord } from "@/utils/typeGuards";

/**
 * The read-only run/execution fetches the workarea inspect tools drive. These
 * mirror the same-named `ToolBridgeApi` methods, but are backed by a
 * project-level backend bridge (not any one tab's canvas) so Prime can inspect
 * runs without spawning a sub-agent.
 */
export type RunInspectDeps = Pick<
  ToolBridgeApi,
  | "getRunDetails"
  | "debugPipelineRun"
  | "getExecutionDetails"
  | "getExecutionState"
  | "getContainerState"
  | "getContainerLog"
>;

/** Live handles into the workarea the remote tools drive. */
export interface WorkareaToolDeps {
  openTarget: (target: WorkareaTarget, title?: string) => Promise<WorkareaTab>;
  getTabs: () => WorkareaTab[];
  getActiveTabId: () => string | undefined;
  closeTab: (id: string) => void;
  getEnvironmentId: (tabId: string) => string | undefined;
  waitForEnvironment: (tabId: string) => Promise<string | undefined>;
  runInspect: RunInspectDeps;
  createPipeline: (
    name?: string,
  ) => Promise<{ pipelineName: string; fileId: string }>;
  clonePipeline: (runId: string) => Promise<{ pipelineName: string }>;
  refreshResources: () => Promise<void>;
}

interface WorkareaTabSummary {
  id: string;
  kind: WorkareaViewKindName;
  title: string;
  target: string;
  active: boolean;
  environmentId?: string;
  ready?: boolean;
}

/** Tabs that host a spawnable sub-agent environment. */
function isSpawnable(tab: WorkareaTab): boolean {
  return tab.target.type === "pipeline" || tab.target.type === "run";
}

function summarize(
  tab: WorkareaTab,
  activeTabId: string | undefined,
  environmentId?: string,
): WorkareaTabSummary {
  const base: WorkareaTabSummary = {
    id: tab.id,
    kind: tab.target.type,
    title: tab.title,
    target: formatWorkareaTarget(tab.target),
    active: tab.id === activeTabId,
  };
  if (!isSpawnable(tab)) return base;
  return { ...base, environmentId, ready: environmentId != null };
}

/**
 * Opens a target and reports the tab. A pipeline or run tab is held back until
 * its sub-agent host connects or the wait gives up, because the tab is worth
 * little to an agent until it can be spawned into; `ready` says which happened.
 */
async function openAndSummarize(
  getDeps: () => WorkareaToolDeps,
  target: WorkareaTarget,
  title?: string,
): Promise<WorkareaTabSummary> {
  const tab = await getDeps().openTarget(target, title);
  if (!isSpawnable(tab)) return summarize(tab, tab.id);

  const environmentId = await getDeps().waitForEnvironment(tab.id);
  const currentDeps = getDeps();
  const currentTab = currentDeps
    .getTabs()
    .find((candidate) => candidate.id === tab.id);
  if (!currentTab) {
    throw new Error(
      `Workarea tab "${tab.id}" was closed before its environment became ready.`,
    );
  }
  return summarize(currentTab, currentDeps.getActiveTabId(), environmentId);
}

function optionalName(args: unknown): string | undefined {
  if (!isRecord(args) || !("name" in args) || args.name === undefined) {
    return undefined;
  }
  if (typeof args.name !== "string" || args.name.trim().length === 0) {
    throw new Error("`name` must be a non-empty string when provided.");
  }
  return args.name.trim();
}

function optionalRunId(args: unknown): string | undefined {
  if (!isRecord(args) || !("runId" in args)) return undefined;
  if (typeof args.runId !== "string" || args.runId.trim().length === 0) {
    throw new Error("`runId` must be a non-empty string when provided.");
  }
  return args.runId;
}

function requireExecutionId(args: unknown): string {
  if (
    !isRecord(args) ||
    typeof args.executionId !== "string" ||
    args.executionId.trim().length === 0
  ) {
    throw new Error(
      "`executionId` is required and must be a non-empty string.",
    );
  }
  return args.executionId;
}

/**
 * Resolves which run to inspect: an explicit `runId` wins, else the active run
 * tab, else the only open run tab. Throws a model-friendly error when the
 * choice is ambiguous or there is no run open.
 */
function resolveRunId(deps: WorkareaToolDeps, explicit?: string): string {
  if (explicit) return explicit;
  const runTabs = deps.getTabs().filter((tab) => tab.target.type === "run");
  if (runTabs.length === 0) {
    throw new Error(
      "No run is open in the workarea. Open a run first (open_workarea_target with `run://id/<runId>`), or pass an explicit `runId`.",
    );
  }
  const activeId = deps.getActiveTabId();
  const active = runTabs.find((tab) => tab.id === activeId);
  if (active) return parseIdentity(active.target.identity).value;
  if (runTabs.length === 1) {
    return parseIdentity(runTabs[0].target.identity).value;
  }
  throw new Error(
    "Multiple runs are open — pass an explicit `runId` to say which one to inspect.",
  );
}

const TARGET_DESCRIPTION =
  "A `type://identity` target: `artifact://id/<url>`, " +
  "`pipeline://id/<fileId>`, `pipeline://name/<name>`, or `run://id/<runId>`. " +
  "Legacy `pipeline://<fileId>`, `run:<id>`, run URLs, artifact URLs, and bare " +
  "pipeline names are also accepted.";

const RUN_ID_SCHEMA = {
  type: "object",
  properties: {
    runId: {
      type: "string",
      description:
        "Pipeline run id. Optional — defaults to the active or only open run tab.",
    },
  },
} as const;

const EXECUTION_ID_SCHEMA = {
  type: "object",
  properties: {
    executionId: { type: "string", description: "Execution id." },
  },
  required: ["executionId"],
} as const;

/**
 * The tab-management + run-inspect tools an agent uses to arrange and read the
 * Dynamic Workarea: create a pipeline, open a resource, list open tabs, read
 * the active tab, close a tab, and inspect an open run.
 *
 * Creating one belongs here rather than with the canvas tools, which are a
 * spawned sub-agent's view of an editor that is already mounted on a loaded
 * pipeline. Nothing downstream of a tab can bring a pipeline into being, so
 * without this an agent asked to build one has nowhere to start.
 *
 * Spawnable (pipeline / run) tabs report an `environmentId` that identifies
 * whether that tab's sub-agent host is connected; the server routes spawns to
 * the prompting person's host, so an agent cannot pick one.
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
        "`{ id, kind, title, target, active }`. For a pipeline or run tab it " +
        "also returns the `environmentId` and `ready` flag showing whether that " +
        "tab's sub-agent host is connected.",
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
        return openAndSummarize(
          getDeps,
          parseWorkareaTarget(args.target),
          title,
        );
      },
    },
    create_pipeline: {
      description:
        "Create a new, empty pipeline and open it in the Dynamic Workarea, " +
        "ready to build on. Use this when asked to build a pipeline and none " +
        "is open — there is no other way to get a canvas from nothing, and the " +
        "canvas editing tools only exist once a pipeline tab is open. `name` is " +
        "optional and is made unique if it is already taken. The pipeline is " +
        "attached to the project automatically (it shows up in Resources). " +
        "Returns the tab summary plus the pipeline `name` and its " +
        "`pipeline://id/<fileId>` `target`, including the `environmentId` and " +
        "`ready` flag for that tab's sub-agent host, so a spawn can follow " +
        "straight on.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Optional name for the new pipeline. Defaults to an untitled one.",
          },
        },
      },
      execute: async (args) => {
        const { pipelineName, fileId } = await getDeps().createPipeline(
          optionalName(args),
        );
        const target: WorkareaTarget = {
          type: "pipeline",
          identity: idIdentity(fileId),
        };
        const tab = await openAndSummarize(getDeps, target, pipelineName);
        return { ...tab, name: pipelineName };
      },
    },
    clone_pipeline: {
      description:
        "Clone the pipeline behind a failed run into a new editable local " +
        "pipeline so it can be fixed without touching the original. `runId` is " +
        "optional and defaults to the active or only open run tab. The clone is " +
        "attached to the project automatically (it shows up in Resources), so " +
        "you do not need to attach or refresh it yourself. Returns the new " +
        "pipeline `name` and a `pipeline://name/<name>` `target` to open with " +
        "open_workarea_target.",
      inputSchema: RUN_ID_SCHEMA,
      execute: async (args) => {
        const deps = getDeps();
        const runId = resolveRunId(deps, optionalRunId(args));
        const { pipelineName } = await deps.clonePipeline(runId);
        return {
          name: pipelineName,
          target: formatWorkareaTarget({
            type: "pipeline",
            identity: nameIdentity(pipelineName),
          }),
        };
      },
    },
    list_workarea_tabs: {
      description:
        "List the tabs currently open in the Dynamic Workarea, each as `{ id, " +
        "kind, title, target, active }`. Pipeline and run tabs also include the " +
        "`environmentId` and `ready` flag for that tab's sub-agent host.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const deps = getDeps();
        const activeTabId = deps.getActiveTabId();
        return deps
          .getTabs()
          .map((tab) =>
            summarize(tab, activeTabId, deps.getEnvironmentId(tab.id)),
          );
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
        return active
          ? summarize(active, activeTabId, deps.getEnvironmentId(active.id))
          : null;
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
    refresh_project_resources: {
      description:
        "Refresh the project's resource list so the Resources window reflects " +
        "the latest state. Call this after creating, updating, or deleting a " +
        "project resource (e.g. a pipeline or run) that the user did not make " +
        "through the UI, so the newly added or modified resource shows up.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        await getDeps().refreshResources();
        return { ok: true };
      },
    },
    get_run_status: {
      description:
        "Fetch run metadata and the derived overall execution status (e.g. " +
        "RUNNING, SUCCEEDED, FAILED) for a run open in the workarea. `runId` is " +
        "optional and defaults to the active or only open run tab.",
      inputSchema: RUN_ID_SCHEMA,
      execute: async (args) => {
        const deps = getDeps();
        const runId = resolveRunId(deps, optionalRunId(args));
        const run = await deps.runInspect.getRunDetails(runId);
        return {
          run,
          status: getOverallExecutionStatusFromStats(
            run.execution_status_stats,
          ),
        };
      },
    },
    debug_pipeline_run: {
      description:
        "Composite debug snapshot for a run open in the workarea: run metadata " +
        "plus each FAILED / SYSTEM_ERROR / INVALID child execution with " +
        "truncated container state, execution details, and logs. Use this as a " +
        "single high-signal call before drilling in with the fine-grained debug " +
        "tools. `runId` is optional and defaults to the active or only open run " +
        "tab.",
      inputSchema: RUN_ID_SCHEMA,
      execute: async (args) => {
        const deps = getDeps();
        const runId = resolveRunId(deps, optionalRunId(args));
        return deps.runInspect.debugPipelineRun(runId);
      },
    },
    get_execution_details: {
      description:
        "Fetch task spec, parent/child ids, and artifact id maps for a single " +
        "execution. Artifact id maps are summarized to keep the payload small.",
      inputSchema: EXECUTION_ID_SCHEMA,
      execute: async (args) => {
        const executionId = requireExecutionId(args);
        const details =
          await getDeps().runInspect.getExecutionDetails(executionId);
        return truncateExecutionDetails(details);
      },
    },
    get_execution_state: {
      description:
        "Fetch aggregated child execution status counts for a graph execution. " +
        "Useful for figuring out which child tasks failed.",
      inputSchema: EXECUTION_ID_SCHEMA,
      execute: async (args) => {
        const executionId = requireExecutionId(args);
        return getDeps().runInspect.getExecutionState(executionId);
      },
    },
    get_container_state: {
      description:
        "Fetch pod/container state (status, exit code, debug_info) for a leaf " +
        "execution. `debug_info` is capped at 20 keys with each string value " +
        "capped at 2KB.",
      inputSchema: EXECUTION_ID_SCHEMA,
      execute: async (args) => {
        const executionId = requireExecutionId(args);
        const state = await getDeps().runInspect.getContainerState(executionId);
        return truncateContainerState(state);
      },
    },
    get_container_log: {
      description:
        "Fetch the trailing 8KB of stdout/stderr and any captured " +
        "error/orchestration messages for a leaf execution. Each field is " +
        "independently truncated; `truncated: true` flags any drop.",
      inputSchema: EXECUTION_ID_SCHEMA,
      execute: async (args) => {
        const executionId = requireExecutionId(args);
        const log = await getDeps().runInspect.getContainerLog(executionId);
        return truncateContainerLog(log);
      },
    },
  };
}
