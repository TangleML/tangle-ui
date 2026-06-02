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

import type {
  ContainerLogPayload,
  ContainerState,
  ExecutionDetails,
  ToolBridgeApi,
} from "../toolBridgeApi";

const LOG_BYTE_BUDGET = 8_192;
const ORCHESTRATION_ERROR_BUDGET = 2_048;
const STRING_FIELD_BUDGET = 2_048;
const MAX_DEBUG_INFO_KEYS = 20;

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Keep the trailing window — for execution logs the failure context
 * almost always lives at the end of the stream, so the head is the
 * easiest part to drop.
 */
function truncateLogText(text: string, budget: number): string {
  if (text.length <= budget) return text;
  return `…[truncated ${text.length - budget} chars]\n${text.slice(-budget)}`;
}

function truncateContainerLog(
  log: ContainerLogPayload,
): ContainerLogPayload & { truncated?: boolean } {
  let truncated = false;
  const result: ContainerLogPayload & { truncated?: boolean } = {};
  if (log.log_text != null) {
    truncated ||= log.log_text.length > LOG_BYTE_BUDGET;
    result.log_text = truncateLogText(log.log_text, LOG_BYTE_BUDGET);
  }
  if (log.system_error_exception_full != null) {
    truncated ||= log.system_error_exception_full.length > LOG_BYTE_BUDGET;
    result.system_error_exception_full = truncateLogText(
      log.system_error_exception_full,
      LOG_BYTE_BUDGET,
    );
  }
  if (log.orchestration_error_message != null) {
    truncated ||=
      log.orchestration_error_message.length > ORCHESTRATION_ERROR_BUDGET;
    result.orchestration_error_message = truncateLogText(
      log.orchestration_error_message,
      ORCHESTRATION_ERROR_BUDGET,
    );
  }
  if (truncated) result.truncated = true;
  return result;
}

function truncateContainerState(state: ContainerState): ContainerState {
  if (!state.debug_info) return state;
  const entries = Object.entries(state.debug_info).slice(
    0,
    MAX_DEBUG_INFO_KEYS,
  );
  const truncatedDebugInfo: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.length > STRING_FIELD_BUDGET) {
      truncatedDebugInfo[key] = truncateLogText(value, STRING_FIELD_BUDGET);
    } else {
      truncatedDebugInfo[key] = value;
    }
  }
  return { ...state, debug_info: truncatedDebugInfo };
}

function truncateExecutionDetails(details: ExecutionDetails): ExecutionDetails {
  // Drop heavy artifact maps to empty objects so the model still knows
  // they exist (and can call `get_execution_state` for counts) without
  // pulling MB of artifact metadata into context.
  const inputCount = Object.keys(details.input_artifacts ?? {}).length;
  const outputCount = Object.keys(details.output_artifacts ?? {}).length;
  return {
    ...details,
    input_artifacts: inputCount > 0 ? {} : details.input_artifacts,
    output_artifacts: outputCount > 0 ? {} : details.output_artifacts,
  };
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
