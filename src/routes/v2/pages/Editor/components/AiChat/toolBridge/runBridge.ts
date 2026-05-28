/**
 * Run-lifecycle bridge handlers.
 *
 * `submitPipelineRun` wraps the existing `@/utils/submitPipeline` helper
 * (so cache invalidation + IDB persistence + auth-token plumbing match
 * the editor's submitter UI exactly). `getRunDetails` is a thin pass-
 * through to the execution service.
 *
 * `debugPipelineRun` is the composite read path used by
 * `debug-assistant`: it fetches the run, the root execution details +
 * state in parallel, then walks failed children (capped at 10) and
 * truncates everything through `@/agent/util/truncate` so a single call
 * cannot blow context.
 */
import type {
  ContainerState,
  RunDebugSnapshot,
  RunDebugSnapshotChild,
  RunDetails,
  RunSubmissionResult,
  ToolBridgeApi,
} from "@/agent/toolBridgeApi";
import {
  truncateContainerLog,
  truncateContainerState,
  truncateExecutionDetails,
} from "@/agent/util/truncate";
import { serializeComponentSpec } from "@/models/componentSpec/serialization/serialize";
import {
  fetchContainerExecutionState,
  fetchContainerLog,
  fetchExecutionDetails,
  fetchExecutionState,
  fetchPipelineRun,
} from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import {
  flattenExecutionStatusStats,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { submitPipelineRun as submitPipelineRunHelper } from "@/utils/submitPipeline";

import type { BridgeDeps } from "./utils";
import { errorMessage, requireBackendUrl, requireSpec } from "./utils";

const MAX_FAILED_CHILDREN = 10;
const FAILED_STATUSES = new Set(["FAILED", "SYSTEM_ERROR", "INVALID"]);

type RunHandlers = Pick<
  ToolBridgeApi,
  "submitPipelineRun" | "getRunDetails" | "debugPipelineRun"
>;

export function createRunBridgeHandlers(deps: BridgeDeps): RunHandlers {
  return {
    async submitPipelineRun(): Promise<RunSubmissionResult> {
      const spec = requireSpec(deps);
      const backendUrl = deps.getBackendUrl?.();
      if (!backendUrl) {
        return {
          success: false,
          error:
            "Backend is not configured — pipeline cannot be submitted from the assistant.",
        };
      }
      const wireSpec = serializeComponentSpec(spec);
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

    async getRunDetails(runId) {
      return fetchPipelineRun(runId, requireBackendUrl(deps));
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
      const failedChildren: RunDebugSnapshotChild[] = [];
      let inspected = 0;
      let truncatedChildren = 0;
      for (const [taskId, executionId] of candidates) {
        if (failedChildren.length >= MAX_FAILED_CHILDREN) {
          truncatedChildren = candidates.length - inspected;
          break;
        }
        inspected += 1;
        const child = await inspectFailedChild(taskId, executionId, backendUrl);
        if (child) failedChildren.push(child);
      }
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

async function inspectFailedChild(
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
    details: details ? truncateExecutionDetails(details) : undefined,
    containerState: truncateContainerState(containerState),
    log: log ? truncateContainerLog(log) : undefined,
  };
}
