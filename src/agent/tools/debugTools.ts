/**
 * Read-only debug tools for the in-browser agent.
 *
 * Each tool wraps a single fine-grained `ToolBridgeApi` fetch and
 * truncates the payload before returning to the model so a single
 * pathological pod log or huge artifact map cannot blow the model's
 * context window.
 *
 * For the high-signal one-shot path use `runTools.debug_pipeline_run`
 * (composite); these are for surgical follow-ups when the composite
 * snapshot already pointed at a specific child execution.
 */
import { tool } from "@openai/agents";
import { z } from "zod";

import {
  truncateContainerLog,
  truncateContainerState,
  truncateExecutionDetails,
} from "@/agent/util/truncate";

import type { ToolBridgeApi } from "../toolBridgeApi";

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

export function createDebugTools(bridge: ToolBridgeApi) {
  const getExecutionDetails = tool({
    name: "get_execution_details",
    description:
      "Fetch task spec, parent/child ids, and artifact id maps for a single execution. Artifact id maps are summarized to keep the payload small.",
    parameters: z.object({
      executionId: z.string().describe("Execution id"),
    }),
    execute: async ({ executionId }) => {
      const details = await bridge.getExecutionDetails(executionId);
      return asJson(truncateExecutionDetails(details));
    },
  });

  const getExecutionState = tool({
    name: "get_execution_state",
    description:
      "Fetch aggregated child execution status counts for a graph execution. Useful for figuring out which child tasks failed.",
    parameters: z.object({
      executionId: z.string().describe("Execution id"),
    }),
    execute: async ({ executionId }) =>
      asJson(await bridge.getExecutionState(executionId)),
  });

  const getContainerState = tool({
    name: "get_container_state",
    description:
      "Fetch pod/container state (status, exit code, debug_info) for a leaf execution. `debug_info` is capped at 20 keys with each string value capped at 2KB.",
    parameters: z.object({
      executionId: z.string().describe("Execution id"),
    }),
    execute: async ({ executionId }) => {
      const state = await bridge.getContainerState(executionId);
      return asJson(truncateContainerState(state));
    },
  });

  const getContainerLog = tool({
    name: "get_container_log",
    description:
      "Fetch the trailing 8KB of stdout/stderr and any captured error/orchestration messages for a leaf execution. Each field is independently truncated; `truncated: true` flags any drop.",
    parameters: z.object({
      executionId: z.string().describe("Execution id"),
    }),
    execute: async ({ executionId }) => {
      const log = await bridge.getContainerLog(executionId);
      return asJson(truncateContainerLog(log));
    },
  });

  return {
    getExecutionDetails,
    getExecutionState,
    getContainerState,
    getContainerLog,
    allTools: [
      getExecutionDetails,
      getExecutionState,
      getContainerState,
      getContainerLog,
    ],
  };
}
