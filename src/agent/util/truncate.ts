/**
 * Shared truncation budgets and helpers for the debug surface.
 *
 * Used by both the worker-side per-tool path in
 * `src/agent/tools/debugTools.ts` and the main-thread composite path in
 * `toolBridge/runBridge.ts`. Keeping the budgets in one place prevents
 * silent drift between "call the tool directly" and "call the composite
 * snapshot" — both routes must enforce identical caps so the model
 * cannot blow context through either entry point.
 */
import type {
  ContainerLogPayload,
  ContainerState,
  ExecutionDetails,
} from "@/agent/toolBridgeApi";

const LOG_BYTE_BUDGET = 8_192;
const ORCHESTRATION_ERROR_BUDGET = 2_048;
const STRING_FIELD_BUDGET = 2_048;
const MAX_DEBUG_INFO_KEYS = 20;

/**
 * Keep the trailing window — for execution logs the failure context
 * almost always lives at the end of the stream, so the head is the
 * easiest part to drop.
 */
function truncateTrailing(text: string, budget: number): string {
  if (text.length <= budget) return text;
  return `…[truncated ${text.length - budget} chars]\n${text.slice(-budget)}`;
}

/**
 * Input accepts both the bridge-normalized `ContainerLogPayload`
 * (string-or-undefined fields) and the raw `fetchContainerLog` wire
 * shape (string-or-null-or-undefined). Output is always the bridge
 * payload with no nulls.
 */
export interface ContainerLogInput {
  log_text?: string | null;
  system_error_exception_full?: string | null;
  orchestration_error_message?: string | null;
}

export function truncateContainerLog(
  log: ContainerLogInput,
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

export function truncateContainerState(state: ContainerState): ContainerState {
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

/**
 * Drop heavy artifact maps to empty objects so the model still knows
 * they exist (and can call `get_execution_state` for counts) without
 * pulling MB of artifact metadata into context.
 */
export function truncateExecutionDetails(
  details: ExecutionDetails,
): ExecutionDetails {
  const inputCount = Object.keys(details.input_artifacts ?? {}).length;
  const outputCount = Object.keys(details.output_artifacts ?? {}).length;
  return {
    ...details,
    input_artifacts: inputCount > 0 ? {} : details.input_artifacts,
    output_artifacts: outputCount > 0 ? {} : details.output_artifacts,
  };
}
