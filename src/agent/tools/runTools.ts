/**
 * Run-management tools for the in-browser agent.
 *
 * Each tool is a thin OpenAI Agents `tool()` wrapper around a method on
 * the Comlink-proxied `ToolBridgeApi`. The bridge runs on the main
 * thread, so existing service helpers (`submitPipelineRun`,
 * `fetchPipelineRun`, …) plus their cache invalidation and IDB writes
 * are reused as-is.
 *
 * `submit_pipeline_run` and `debug_pipeline_run` are exposed both as
 * individual tools (composable into different sub-agent tool surfaces)
 * and as part of `allTools` for convenience. Same factory pattern as
 * `csomTools.ts`.
 */
import { tool } from "@openai/agents";
import { z } from "zod";

import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

import type { RunDetails, ToolBridgeApi } from "../toolBridgeApi";

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

function deriveRunStatus(run: RunDetails): string | undefined {
  return getOverallExecutionStatusFromStats(run.execution_status_stats);
}

export function createRunTools(bridge: ToolBridgeApi) {
  const submitPipelineRun = tool({
    name: "submit_pipeline_run",
    description:
      "Submit the currently-open pipeline to the backend for execution. Only call this when the user has explicitly asked to run the pipeline. Always submits the live pipeline. A run uses the secrets of whoever submits it: it goes as the user unless asTeam is set, or unless it needs a secret only the project's workspace has, in which case it goes as the workspace. The result's actingAsWorkspace names the workspace it went as, and actingAsTeam is that workspace's team id.",
    parameters: z.object({
      asTeam: z
        .boolean()
        .nullable()
        .optional()
        .describe(
          "Submit as the project's workspace, so the run uses the workspace's secrets instead of the user's. Set it when the user asks for the workspace, or when the run needs a secret only the workspace has. Refused when the user can't act as the workspace.",
        ),
    }),
    execute: async ({ asTeam }) =>
      asJson(await bridge.submitPipelineRun({ asTeam: asTeam ?? undefined })),
  });

  const getRunStatus = tool({
    name: "get_run_status",
    description:
      "Fetch run metadata and the derived overall execution status (e.g. RUNNING, SUCCEEDED, FAILED) for a pipeline run by id.",
    parameters: z.object({
      runId: z.string().describe("Pipeline run id"),
    }),
    execute: async ({ runId }) => {
      const run = await bridge.getRunDetails(runId);
      return asJson({
        run,
        status: deriveRunStatus(run),
      });
    },
  });

  const debugPipelineRun = tool({
    name: "debug_pipeline_run",
    description:
      "Composite debug snapshot for a pipeline run: returns run metadata + each FAILED / SYSTEM_ERROR / INVALID child execution with truncated container state, execution details, and logs. Use this as a single high-signal call before drilling in with the fine-grained debug tools.",
    parameters: z.object({
      runId: z.string().describe("Pipeline run id"),
    }),
    execute: async ({ runId }) => asJson(await bridge.debugPipelineRun(runId)),
  });

  return {
    submitPipelineRun,
    getRunStatus,
    debugPipelineRun,
    allTools: [submitPipelineRun, getRunStatus, debugPipelineRun],
  };
}
