/**
 * Tools for submitting, monitoring, and debugging pipeline runs
 * against the Tangle backend API.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { config } from "../config";

async function tangleApi(
  path: string,
  options?: RequestInit,
): Promise<unknown> {
  const url = `${config.tangleApiUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tangle API ${res.status}: ${body}`);
  }
  return res.json();
}

export const submitPipelineRun = tool(
  async ({
    pipelineSpec,
    runName,
  }: {
    pipelineSpec: string;
    runName?: string;
  }) => {
    try {
      const result = await tangleApi("/api/runs/", {
        method: "POST",
        body: JSON.stringify({
          pipeline_spec: JSON.parse(pipelineSpec),
          run_name: runName,
        }),
      });
      return JSON.stringify({ success: true, run: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ success: false, error: message });
    }
  },
  {
    name: "submit_pipeline_run",
    description:
      "Submit a pipeline spec to the Tangle backend for execution. Returns the created run details.",
    schema: z.object({
      pipelineSpec: z
        .string()
        .describe("JSON string of the pipeline spec to run"),
      runName: z.string().optional().describe("Optional human-readable name"),
    }),
  },
);

export const getRunStatus = tool(
  async ({ runId }: { runId: string }) => {
    try {
      const result = await tangleApi(`/api/runs/${runId}`);
      return JSON.stringify({ success: true, run: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ success: false, error: message });
    }
  },
  {
    name: "get_run_status",
    description: "Get the current status of a pipeline run.",
    schema: z.object({
      runId: z.string().describe("The run ID to check"),
    }),
  },
);

export const debugPipelineRun = tool(
  async ({ runId }: { runId: string }) => {
    try {
      const [run, tasks] = await Promise.all([
        tangleApi(`/api/runs/${runId}`),
        tangleApi(`/api/runs/${runId}/tasks`).catch(() => null),
      ]);
      return JSON.stringify({ success: true, run, tasks });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ success: false, error: message });
    }
  },
  {
    name: "debug_pipeline_run",
    description:
      "Fetch detailed run info including per-task statuses, outputs, and error logs for debugging.",
    schema: z.object({
      runId: z.string().describe("The run ID to debug"),
    }),
  },
);

export const pipelineRunTools = [
  submitPipelineRun,
  getRunStatus,
  debugPipelineRun,
];
