/**
 * Main-thread implementation of the agent's `ToolBridgeApi`.
 *
 * Each method mutates the LIVE MobX `ComponentSpec` from the editor
 * session inside an undo group, so the agent's edits are user-visible
 * immediately and undoable as a single step. The worker proxies these
 * methods via Comlink; no command serialization or tempId remapping is
 * needed.
 *
 * Bridge deps are deliberately tiny — the bridge owns no React or MobX
 * subscriptions of its own, which keeps it trivially testable: feed it
 * a `ComponentSpec` and an `UndoGroupable` and every method works.
 */
import type { QueryClient } from "@tanstack/react-query";

import type {
  ConnectArgs,
  ContainerLogPayload,
  ContainerState,
  ExecutionDetails,
  ExecutionState,
  RunDebugSnapshot,
  RunDebugSnapshotChild,
  RunDetails,
  RunSubmissionResult,
  ToolBridgeApi,
  ValidationResult,
} from "@/agent/toolBridgeApi";
import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpec } from "@/models/componentSpec/serialization/serialize";
import { validateSpec } from "@/models/componentSpec/validation/validateSpec";
import {
  connectNodes,
  deleteSelectedEdgesByEdgeIds,
} from "@/routes/v2/pages/Editor/store/actions/connection.actions";
import {
  addInput,
  addOutput,
  deleteInput,
  deleteOutput,
  renameInput,
  renameOutput,
  setInputDefaultValue,
  setInputDescription,
  setInputType,
  setOutputDescription,
} from "@/routes/v2/pages/Editor/store/actions/io.actions";
import {
  createSubgraph,
  renamePipeline,
  updatePipelineDescription,
} from "@/routes/v2/pages/Editor/store/actions/pipeline.actions";
import {
  addTask,
  deleteTask,
  renameTask,
  unpackSubgraphTask,
} from "@/routes/v2/pages/Editor/store/actions/task.actions";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { hydrateComponentReference } from "@/services/componentService";
import {
  fetchContainerExecutionState,
  fetchContainerLog,
  fetchExecutionDetails,
  fetchExecutionState,
  fetchPipelineRun,
} from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
import { deepClone } from "@/utils/deepClone";
import {
  flattenExecutionStatusStats,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { submitPipelineRun as submitPipelineRunHelper } from "@/utils/submitPipeline";

import { serializeSpecForAi } from "./serializeSpecForAi";

const DEFAULT_POSITION = { x: 250, y: 250 };
const POSITION_OFFSET = 200;

const MAX_FAILED_CHILDREN = 10;
const FAILED_STATUSES = new Set(["FAILED", "SYSTEM_ERROR", "INVALID"]);

interface BridgeDeps {
  getSpec: () => ComponentSpec | null;
  getActiveSubgraphPath: () => string[];
  undo: UndoGroupable;
  getBackendUrl?: () => string;
  getAuthToken?: () => string | undefined;
  queryClient?: QueryClient;
}

interface EntityWithAnnotations {
  annotations: { get(key: string): unknown };
}

function computeNextPosition(spec: ComponentSpec): { x: number; y: number } {
  const allEntities: EntityWithAnnotations[] = [
    ...spec.tasks,
    ...spec.inputs,
    ...spec.outputs,
  ];
  if (allEntities.length === 0) return DEFAULT_POSITION;

  let maxX = 0;
  let maxY = 0;
  for (const entity of allEntities) {
    const pos = entity.annotations.get(EDITOR_POSITION_ANNOTATION) as
      | { x: number; y: number }
      | undefined;
    if (pos) {
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
  }
  return { x: maxX + POSITION_OFFSET, y: maxY };
}

/**
 * Builds the bridge implementation. Returned object is intended to be
 * exposed to the worker via `Comlink.proxy()`. Methods throw when the
 * spec is unavailable (no pipeline open) so the worker surfaces a clear
 * error to the model.
 */
export function createToolBridge(deps: BridgeDeps): ToolBridgeApi {
  function requireSpec(): ComponentSpec {
    const spec = deps.getSpec();
    if (!spec) {
      throw new Error(
        "No pipeline is currently open — open a pipeline before asking the agent to edit it.",
      );
    }
    return spec;
  }

  function requireBackendUrl(): string {
    const url = deps.getBackendUrl?.();
    if (!url) {
      throw new Error(
        "Backend is not configured — agent cannot reach the Tangle backend.",
      );
    }
    return url;
  }

  return {
    async getPipelineState() {
      return serializeSpecForAi(requireSpec(), {
        activeSubgraphPath: deps.getActiveSubgraphPath(),
      });
    },

    async setPipelineName(name) {
      const spec = requireSpec();
      renamePipeline(deps.undo, spec, name);
      return { success: true };
    },

    async setPipelineDescription(description) {
      const spec = requireSpec();
      updatePipelineDescription(deps.undo, spec, description);
      return { success: true };
    },

    async addTask({ name, componentRef }) {
      const spec = requireSpec();
      const hydrated =
        (await hydrateComponentReference(componentRef)) ?? componentRef;
      const position = computeNextPosition(spec);
      const task = addTask(deps.undo, spec, hydrated, position);
      if (!task) {
        return { success: false, error: "addTask returned no task" };
      }
      if (name && task.name !== name) {
        renameTask(deps.undo, spec, task.$id, name);
      }
      return { success: true, taskId: task.$id, name: task.name };
    },

    async deleteTask(entityId) {
      const spec = requireSpec();
      return { success: deleteTask(deps.undo, spec, entityId) };
    },

    async renameTask(entityId, newName) {
      const spec = requireSpec();
      return { success: renameTask(deps.undo, spec, entityId, newName) };
    },

    async addInput({ name, type, description, defaultValue, optional }) {
      const spec = requireSpec();
      const position = computeNextPosition(spec);
      const input = addInput(deps.undo, spec, position, name);
      if (type) setInputType(deps.undo, spec, input.$id, type);
      if (description)
        setInputDescription(deps.undo, spec, input.$id, description);
      if (defaultValue)
        setInputDefaultValue(deps.undo, spec, input.$id, defaultValue);
      if (optional !== undefined) {
        deps.undo.withGroup("Set input optional", () => {
          input.setOptional(optional);
        });
      }
      return { success: true, inputId: input.$id, name: input.name };
    },

    async deleteInput(entityId) {
      const spec = requireSpec();
      return { success: deleteInput(deps.undo, spec, entityId) };
    },

    async renameInput(entityId, newName) {
      const spec = requireSpec();
      return { success: renameInput(deps.undo, spec, entityId, newName) };
    },

    async addOutput({ name, type, description }) {
      const spec = requireSpec();
      const position = computeNextPosition(spec);
      const output = addOutput(deps.undo, spec, position, name);
      if (type) {
        deps.undo.withGroup("Set output type", () => output.setType(type));
      }
      if (description)
        setOutputDescription(deps.undo, spec, output.$id, description);
      return { success: true, outputId: output.$id, name: output.name };
    },

    async deleteOutput(entityId) {
      const spec = requireSpec();
      return { success: deleteOutput(deps.undo, spec, entityId) };
    },

    async renameOutput(entityId, newName) {
      const spec = requireSpec();
      return { success: renameOutput(deps.undo, spec, entityId, newName) };
    },

    async connectNodes(args: ConnectArgs) {
      const spec = requireSpec();
      const ok = connectNodes(deps.undo, spec, {
        sourceNodeId: args.sourceEntityId,
        sourceHandleId: `output_${args.sourcePortName}`,
        targetNodeId: args.targetEntityId,
        targetHandleId: `input_${args.targetPortName}`,
      });
      if (!ok) {
        return {
          success: false,
          error:
            "Could not create binding — invalid source/target combination.",
        };
      }
      const binding = spec.bindings.find(
        (b) =>
          b.sourceEntityId === args.sourceEntityId &&
          b.sourcePortName === args.sourcePortName &&
          b.targetEntityId === args.targetEntityId &&
          b.targetPortName === args.targetPortName,
      );
      if (!binding) {
        return {
          success: true,
          error: "Connection created but binding id could not be resolved.",
        };
      }
      return { success: true, bindingId: binding.$id };
    },

    async deleteEdge(entityId) {
      const spec = requireSpec();
      deleteSelectedEdgesByEdgeIds(deps.undo, spec, [`edge_${entityId}`]);
      return { success: true };
    },

    async setTaskArgument(taskEntityId, inputName, value) {
      const spec = requireSpec();
      const task = spec.tasks.find((t) => t.$id === taskEntityId);
      if (!task) {
        return { success: false, error: `No task with id ${taskEntityId}` };
      }
      const hasInput = task.componentRef.spec?.inputs?.some(
        (i) => i.name === inputName,
      );
      if (!hasInput) {
        return {
          success: false,
          error: `Task has no input named "${inputName}"`,
        };
      }
      deps.undo.withGroup("Set task argument", () => {
        spec.setTaskArgument(taskEntityId, inputName, value);
      });
      return { success: true };
    },

    async createSubgraph(taskEntityIds, subgraphName) {
      const spec = requireSpec();
      const position = computeNextPosition(spec);
      const subgraphTask = createSubgraph(
        deps.undo,
        spec,
        taskEntityIds,
        subgraphName,
        position,
      );
      if (!subgraphTask) {
        return { success: false, error: "Could not create subgraph" };
      }
      return { success: true, subgraphTaskId: subgraphTask.$id };
    },

    async unpackSubgraph(taskEntityId) {
      const spec = requireSpec();
      return { success: unpackSubgraphTask(deps.undo, spec, taskEntityId) };
    },

    async validatePipeline(): Promise<ValidationResult> {
      const issues = validateSpec(requireSpec());
      return {
        valid: issues.length === 0,
        issueCount: issues.length,
        issues: issues.map((i) => ({
          type: i.type,
          severity: i.severity,
          message: i.message,
          entityId: i.entityId,
          issueCode: i.issueCode,
        })),
      };
    },

    async submitPipelineRun(): Promise<RunSubmissionResult> {
      const spec = requireSpec();
      const backendUrl = deps.getBackendUrl?.();
      if (!backendUrl) {
        return {
          success: false,
          error:
            "Backend is not configured — pipeline cannot be submitted from the assistant.",
        };
      }
      const wireSpec = deepClone(serializeComponentSpec(spec));
      const authorizationToken = deps.getAuthToken?.();
      const submission = await new Promise<{
        run: PipelineRun | null;
        error: string | null;
      }>((resolve) => {
        submitPipelineRunHelper(wireSpec, backendUrl, {
          authorizationToken,
          onSuccess: (data) => resolve({ run: data, error: null }),
          onError: (err) => resolve({ run: null, error: errorMessage(err) }),
        });
      });
      if (!submission.run) {
        return {
          success: false,
          error:
            submission.error ??
            "Pipeline submission failed — the backend rejected the run.",
        };
      }
      // Refresh both the editor list (per pipeline) and the home runs page.
      deps.queryClient?.invalidateQueries({ queryKey: ["pipelineRuns"] });
      return {
        success: true,
        runId: String(submission.run.id),
        rootExecutionId: String(submission.run.root_execution_id),
      };
    },

    async getRunDetails(runId): Promise<RunDetails> {
      return fetchPipelineRun(runId, requireBackendUrl());
    },

    async getExecutionDetails(executionId): Promise<ExecutionDetails> {
      return fetchExecutionDetails(executionId, requireBackendUrl());
    },

    async getExecutionState(executionId): Promise<ExecutionState> {
      return fetchExecutionState(executionId, requireBackendUrl());
    },

    async getContainerState(executionId): Promise<ContainerState> {
      return fetchContainerExecutionState(executionId, requireBackendUrl());
    },

    async getContainerLog(executionId): Promise<ContainerLogPayload> {
      const log = await fetchContainerLog(executionId, requireBackendUrl());
      return {
        log_text: log.log_text ?? undefined,
        system_error_exception_full:
          log.system_error_exception_full ?? undefined,
        orchestration_error_message:
          log.orchestration_error_message ?? undefined,
      };
    },

    async debugPipelineRun(runId): Promise<RunDebugSnapshot> {
      const backendUrl = deps.getBackendUrl?.();
      if (!backendUrl) {
        return {
          success: false,
          failedChildren: [],
          truncatedChildren: 0,
          error:
            "Backend is not configured — cannot fetch debug info for this run.",
        };
      }
      let run: RunDetails;
      try {
        run = await fetchPipelineRun(runId, backendUrl);
      } catch (error) {
        return {
          success: false,
          failedChildren: [],
          truncatedChildren: 0,
          error: errorMessage(error),
        };
      }
      const rootId = run.root_execution_id;
      const [rootDetails, rootStateOrNull] = await Promise.all([
        fetchExecutionDetails(rootId, backendUrl).catch(() => null),
        fetchExecutionState(rootId, backendUrl).catch(() => null),
      ]);
      if (!rootDetails && !rootStateOrNull) {
        return {
          success: false,
          failedChildren: [],
          truncatedChildren: 0,
          error:
            "Could not fetch execution details for the run (execution details and state both failed).",
        };
      }
      const rootStatus = rootStateOrNull
        ? getOverallExecutionStatusFromStats(
            flattenExecutionStatusStats(
              rootStateOrNull.child_execution_status_stats,
            ),
          )
        : undefined;
      const candidates = Object.entries(
        rootDetails?.child_task_execution_ids ?? {},
      );
      const inspected = await Promise.all(
        candidates.map(([taskId, executionId]) =>
          inspectFailedChildImpl(taskId, executionId, backendUrl),
        ),
      );
      const allFailed = inspected.filter(
        (c): c is RunDebugSnapshotChild => c !== null,
      );
      const failedChildren = allFailed.slice(0, MAX_FAILED_CHILDREN);
      const truncatedChildren = Math.max(
        0,
        allFailed.length - MAX_FAILED_CHILDREN,
      );
      return {
        success: true,
        run,
        rootExecutionId: rootId,
        rootStatus,
        failedChildren,
        truncatedChildren,
      };
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred";
}

const LOG_BYTE_BUDGET = 8_192;
const ORCHESTRATION_ERROR_BUDGET = 2_048;
const STRING_FIELD_BUDGET = 2_048;
const MAX_DEBUG_INFO_KEYS = 20;

function truncateTrailing(text: string, budget: number): string {
  if (text.length <= budget) return text;
  return `…[truncated ${text.length - budget} chars]\n${text.slice(-budget)}`;
}

function truncateContainerLogPayload(
  log: Awaited<ReturnType<typeof fetchContainerLog>>,
): ContainerLogPayload {
  let truncated = false;
  const result: ContainerLogPayload = {};
  if (log.log_text != null) {
    truncated ||= log.log_text.length > LOG_BYTE_BUDGET;
    result.log_text = truncateTrailing(log.log_text, LOG_BYTE_BUDGET);
  }
  if (log.system_error_exception_full != null) {
    truncated ||= log.system_error_exception_full.length > LOG_BYTE_BUDGET;
    result.system_error_exception_full = truncateTrailing(
      log.system_error_exception_full,
      LOG_BYTE_BUDGET,
    );
  }
  if (log.orchestration_error_message != null) {
    truncated ||=
      log.orchestration_error_message.length > ORCHESTRATION_ERROR_BUDGET;
    result.orchestration_error_message = truncateTrailing(
      log.orchestration_error_message,
      ORCHESTRATION_ERROR_BUDGET,
    );
  }
  if (truncated) result.truncated = true;
  return result;
}

function truncateContainerStateForSnapshot(
  state: ContainerState,
): ContainerState {
  if (!state.debug_info) return state;
  const entries = Object.entries(state.debug_info).slice(
    0,
    MAX_DEBUG_INFO_KEYS,
  );
  const truncatedDebugInfo: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.length > STRING_FIELD_BUDGET) {
      truncatedDebugInfo[key] = truncateTrailing(value, STRING_FIELD_BUDGET);
    } else {
      truncatedDebugInfo[key] = value;
    }
  }
  return { ...state, debug_info: truncatedDebugInfo };
}

function truncateExecutionDetailsForSnapshot(
  details: ExecutionDetails,
): ExecutionDetails {
  // Keep top-level identity + spec, drop heavy artifact maps to a count.
  const inputCount = Object.keys(details.input_artifacts ?? {}).length;
  const outputCount = Object.keys(details.output_artifacts ?? {}).length;
  const summarized: ExecutionDetails = {
    ...details,
    input_artifacts: inputCount > 0 ? {} : details.input_artifacts,
    output_artifacts: outputCount > 0 ? {} : details.output_artifacts,
  };
  return summarized;
}

async function inspectFailedChildImpl(
  taskId: string,
  executionId: string,
  backendUrl: string,
): Promise<RunDebugSnapshotChild | null> {
  let containerState: ContainerState | null = null;
  try {
    containerState = await fetchContainerExecutionState(
      executionId,
      backendUrl,
    );
  } catch {
    return null;
  }
  if (!FAILED_STATUSES.has(containerState.status)) return null;
  const [details, log] = await Promise.all([
    fetchExecutionDetails(executionId, backendUrl).catch(() => null),
    fetchContainerLog(executionId, backendUrl).catch(() => null),
  ]);
  return {
    taskId,
    executionId,
    status: containerState.status,
    details: details ? truncateExecutionDetailsForSnapshot(details) : undefined,
    containerState: truncateContainerStateForSnapshot(containerState),
    log: log ? truncateContainerLogPayload(log) : undefined,
  };
}
