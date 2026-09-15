import type { RemoteToolMap } from "@tangent/remote-subagent";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import {
  truncateContainerLog,
  truncateContainerState,
  truncateExecutionDetails,
} from "@/agent/util/truncate";
import type { WorkareaTab } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
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
  openTarget: (target: string, title?: string) => Promise<WorkareaTab>;
  getTabs: () => WorkareaTab[];
  getActiveTabId: () => string | undefined;
  closeTab: (id: string) => void;
  /** The remote-env id a pipeline/run tab's agent connected with, if any. */
  getEnvironmentId: (tabId: string) => string | undefined;
  /** Resolve once a pipeline/run tab's agent connects, or `undefined`. */
  waitForEnvironment: (tabId: string) => Promise<string | undefined>;
  /** Read-only run/execution fetches backed by the project's backend. */
  runInspect: RunInspectDeps;
}

interface WorkareaTabSummary {
  id: string;
  kind: WorkareaTab["kind"];
  title: string;
  /**
   * For pipeline and run tabs, the remote-env id to spawn a sub-agent into so
   * it drives *this* tab. Absent until the tab's agent connects.
   */
  environmentId?: string;
  /** Whether the tab's agent is connected and ready to receive spawns. */
  ready?: boolean;
}

/** Tabs that host a spawnable sub-agent environment. */
function isSpawnable(tab: WorkareaTab): boolean {
  return tab.kind === "pipeline" || tab.kind === "run";
}

function summarize(
  tab: WorkareaTab,
  environmentId?: string,
): WorkareaTabSummary {
  const base = { id: tab.id, kind: tab.kind, title: tab.title };
  if (!isSpawnable(tab)) return base;
  return { ...base, environmentId, ready: environmentId != null };
}

function optionalRunId(args: unknown): string | undefined {
  if (isRecord(args) && typeof args.runId === "string") return args.runId;
  return undefined;
}

function requireExecutionId(args: unknown): string {
  if (!isRecord(args) || typeof args.executionId !== "string") {
    throw new Error("`executionId` is required and must be a string.");
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
  const runTabs = deps
    .getTabs()
    .filter(
      (tab): tab is Extract<WorkareaTab, { kind: "run" }> => tab.kind === "run",
    );
  if (runTabs.length === 0) {
    throw new Error(
      "No run is open in the workarea. Open a run first (open_pipeline with a run URL or `run:<id>`), or pass an explicit `runId`.",
    );
  }
  const activeId = deps.getActiveTabId();
  const active = runTabs.find((tab) => tab.id === activeId);
  if (active) return active.runId;
  if (runTabs.length === 1) return runTabs[0].runId;
  throw new Error(
    "Multiple runs are open — pass an explicit `runId` to say which one to inspect.",
  );
}

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
 * Builds the remote tool catalog that lets a Tangent agent open, manage, and
 * inspect pipelines and runs in the project's Dynamic Workarea. `getDeps` is
 * read on each call so the tools always act on the current workarea state.
 */
export function createWorkareaRemoteTools(
  getDeps: () => WorkareaToolDeps,
): RemoteToolMap {
  return {
    open_pipeline: {
      description:
        "Open a pipeline or run in the project's Dynamic Workarea. `target` may " +
        "be a `pipeline://<fileId>` draft URI, a run URL or `run:<id>` (opens " +
        "the run's canvas to inspect its execution), or a pipeline name. For a " +
        "pipeline tab, returns the tab's `environmentId`: to edit the pipeline, " +
        "spawn an editor sub-agent into that environment (its CSOM tools drive " +
        "this exact pipeline). For a run tab, returns the tab's `environmentId` " +
        "too: spawn a read-only run-inspector sub-agent into it, or inspect the " +
        "run directly with `get_run_status` / `debug_pipeline_run`. Do not use " +
        "the workarea tools to edit pipeline contents.",
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
        if (!isSpawnable(tab)) return summarize(tab);
        const environmentId = await getDeps().waitForEnvironment(tab.id);
        return summarize(tab, environmentId);
      },
    },
    list_workarea_tabs: {
      description:
        "List the tabs currently open in the Dynamic Workarea. Each pipeline " +
        "or run tab includes the `environmentId` to spawn a sub-agent into.",
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
