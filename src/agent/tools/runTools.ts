/**
 * Pipeline run tools — browser fetch against the Tangle backend.
 * Mirrors `scripts/agent/mcp/pipelineRunTools.ts`.
 */
import { tool } from "@openai/agents";
import { z } from "zod";

import { config } from "../config";

async function tangleApi(
  path: string,
  options?: RequestInit,
): Promise<unknown> {
  const url = `${config.tangleApiUrl}${path}`;
  const res = await fetch(url, {
    credentials: "include",
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

const submitPipelineRun = tool({
  name: "submit_pipeline_run",
  description:
    "Submit a pipeline spec to the Tangle backend for execution. Returns the created run details.",
  parameters: z.object({
    pipelineSpec: z
      .string()
      .describe("JSON string of the pipeline spec to run"),
    runName: z
      .string()
      .nullable()
      .optional()
      .describe("Optional human-readable name"),
  }),
  execute: async ({ pipelineSpec, runName }) => {
    try {
      const result = await tangleApi("/api/runs/", {
        method: "POST",
        body: JSON.stringify({
          pipeline_spec: JSON.parse(pipelineSpec),
          run_name: runName ?? undefined,
        }),
      });
      return JSON.stringify({ success: true, run: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ success: false, error: message });
    }
  },
});

const getRunStatus = tool({
  name: "get_run_status",
  description: "Get the current status of a pipeline run.",
  parameters: z.object({
    runId: z.string().describe("The run ID to check"),
  }),
  execute: async ({ runId }) => {
    try {
      const result = await tangleApi(`/api/runs/${runId}`);
      return JSON.stringify({ success: true, run: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ success: false, error: message });
    }
  },
});

const debugPipelineRun = tool({
  name: "debug_pipeline_run",
  description:
    "Fetch detailed run info including per-task statuses, outputs, and error logs for debugging.",
  parameters: z.object({
    runId: z.string().describe("The run ID to debug"),
  }),
  execute: async ({ runId }) => {
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
});

export const pipelineRunTools = [
  submitPipelineRun,
  getRunStatus,
  debugPipelineRun,
];
