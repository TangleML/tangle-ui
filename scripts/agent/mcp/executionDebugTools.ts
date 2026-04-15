/**
 * Tools for diagnosing pipeline run failures by querying the Tangle
 * backend execution APIs. All tools are read-only.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { config } from "../config";

// ---------------------------------------------------------------------------
// Shared API helper
// ---------------------------------------------------------------------------

async function tangleApi(path: string): Promise<unknown> {
  const url = `${config.tangleApiUrl}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tangle API ${res.status}: ${body}`);
  }
  return res.json();
}

function errorResult(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return JSON.stringify({ success: false, error: message });
}

// ---------------------------------------------------------------------------
// Response truncation helpers
// ---------------------------------------------------------------------------

/**
 * Strips verbose fields from execution details to keep context window small.
 * Removes `componentRef.text` (full YAML), keeps `componentRef.spec.name`.
 */
function truncateExecutionDetails(data: Record<string, unknown>): unknown {
  const clone = structuredClone(data);
  truncateTaskSpec(clone);
  return clone;
}

function truncateTaskSpec(obj: Record<string, unknown>): void {
  const taskSpec = obj.task_spec as Record<string, unknown> | undefined;
  if (!taskSpec) return;

  const compRef = taskSpec.componentRef as Record<string, unknown> | undefined;
  if (!compRef) return;

  if (typeof compRef.text === "string") {
    compRef.text = (compRef.text as string).slice(0, 200) + "… [truncated]";
  }

  const spec = compRef.spec as Record<string, unknown> | undefined;
  if (!spec?.implementation) return;

  const impl = spec.implementation as Record<string, unknown>;
  const graph = impl.graph as Record<string, unknown> | undefined;
  if (!graph?.tasks) return;

  const tasks = graph.tasks as Record<string, Record<string, unknown>>;
  for (const task of Object.values(tasks)) {
    const ref = task.componentRef as Record<string, unknown> | undefined;
    if (ref && typeof ref.text === "string") {
      ref.text = (ref.text as string).slice(0, 200) + "… [truncated]";
    }
  }
}

/**
 * Strips verbose Kubernetes pod spec fields from container state,
 * keeping only the fields useful for debugging.
 */
function truncateContainerState(data: Record<string, unknown>): unknown {
  const clone = structuredClone(data);
  const debugInfo = clone.debug_info as Record<string, unknown> | undefined;
  if (!debugInfo?.kubernetes) return clone;

  const k8s = debugInfo.kubernetes as Record<string, unknown>;
  const pod = k8s.debug_pod as Record<string, unknown> | undefined;
  if (!pod) return clone;

  const podSpec = pod.spec as Record<string, unknown> | undefined;
  const podStatus = pod.status as Record<string, unknown> | undefined;

  if (podSpec) {
    const containers = podSpec.containers as Array<
      Record<string, unknown>
    > | null;
    const main = containers?.[0];
    pod.spec = {
      containers: main
        ? [
            {
              name: main.name,
              image: main.image,
              command: main.command,
              env: main.env,
            },
          ]
        : [],
    };
  }

  if (podStatus) {
    pod.status = {
      phase: podStatus.phase,
      containerStatuses: podStatus.containerStatuses,
    };
  }

  delete pod.metadata;

  return clone;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const getPipelineRun = tool(
  async ({ pipelineRunId }: { pipelineRunId: string }) => {
    try {
      const result = await tangleApi(`/api/pipeline_runs/${pipelineRunId}`);
      return JSON.stringify({ success: true, data: result });
    } catch (err) {
      return errorResult(err);
    }
  },
  {
    name: "get_pipeline_run",
    description:
      "Fetch pipeline run metadata including root_execution_id, created_by, and created_at. " +
      "Use this as the entry point: given a pipeline run ID, get the root_execution_id needed for all subsequent execution queries.",
    schema: z.object({
      pipelineRunId: z
        .string()
        .describe("The pipeline run ID (e.g. '019d8aa683a9f1f1aa75')"),
    }),
  },
);

const getExecutionState = tool(
  async ({ executionId }: { executionId: string }) => {
    try {
      const result = await tangleApi(`/api/executions/${executionId}/state`);
      return JSON.stringify({ success: true, data: result });
    } catch (err) {
      return errorResult(err);
    }
  },
  {
    name: "get_execution_state",
    description:
      "Fetch execution graph state with per-child-execution status statistics. " +
      "Returns child_execution_status_stats mapping each child execution ID to a status count " +
      '(e.g. {"SYSTEM_ERROR": 1}). Use on the root_execution_id to quickly see which child tasks failed.',
    schema: z.object({
      executionId: z
        .string()
        .describe(
          "The execution ID (typically the root_execution_id from a pipeline run)",
        ),
    }),
  },
);

const getExecutionDetails = tool(
  async ({ executionId }: { executionId: string }) => {
    try {
      const result = (await tangleApi(
        `/api/executions/${executionId}/details`,
      )) as Record<string, unknown>;
      const truncated = truncateExecutionDetails(result);
      return JSON.stringify({ success: true, data: truncated });
    } catch (err) {
      return errorResult(err);
    }
  },
  {
    name: "get_execution_details",
    description:
      "Fetch full execution details including task_spec, child_task_execution_ids (maps task name -> execution ID), " +
      "input_artifacts, and output_artifacts. Use this to understand the pipeline graph structure and " +
      "map task names to their execution IDs for further investigation.",
    schema: z.object({
      executionId: z.string().describe("The execution ID to get details for"),
    }),
  },
);

const getContainerState = tool(
  async ({ executionId }: { executionId: string }) => {
    try {
      const result = (await tangleApi(
        `/api/executions/${executionId}/container_state`,
      )) as Record<string, unknown>;
      const truncated = truncateContainerState(result);
      return JSON.stringify({ success: true, data: truncated });
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        return JSON.stringify({
          success: false,
          error:
            "No container state available — this execution may not have launched a container " +
            "(typical for statuses: QUEUED, WAITING_FOR_UPSTREAM, SKIPPED).",
        });
      }
      return errorResult(err);
    }
  },
  {
    name: "get_container_state",
    description:
      "Fetch container execution state including status, exit_code, started_at, ended_at, and Kubernetes debug_info. " +
      "Only available when a container was actually launched (PENDING, RUNNING, SUCCEEDED, FAILED, and sometimes SYSTEM_ERROR/CANCELLED). " +
      "Returns 404-friendly message for executions that never launched a container.",
    schema: z.object({
      executionId: z
        .string()
        .describe(
          "The execution ID (use a leaf/container execution ID from child_task_execution_ids, not the root)",
        ),
    }),
  },
);

const getContainerLog = tool(
  async ({ executionId }: { executionId: string }) => {
    try {
      const result = await tangleApi(
        `/api/executions/${executionId}/container_log`,
      );
      return JSON.stringify({ success: true, data: result });
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        return JSON.stringify({
          success: false,
          error:
            "No container logs available — the container may not have been launched or logs were not captured.",
        });
      }
      return errorResult(err);
    }
  },
  {
    name: "get_container_log",
    description:
      "Fetch container execution logs. May contain 'log' (stdout/stderr from the container) and/or " +
      "'system_error_exception_full' (orchestrator-side stack trace). " +
      "This is the MOST IMPORTANT tool for diagnosing FAILED and SYSTEM_ERROR executions — always check logs first.",
    schema: z.object({
      executionId: z
        .string()
        .describe(
          "The execution ID to get logs for (use a leaf/container execution ID, not the root)",
        ),
    }),
  },
);

export const executionDebugTools = [
  getPipelineRun,
  getExecutionState,
  getExecutionDetails,
  getContainerState,
  getContainerLog,
];
