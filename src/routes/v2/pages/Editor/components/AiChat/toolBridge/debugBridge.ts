/**
 * Fine-grained read-only bridge handlers used by `debug-assistant`.
 *
 * Each handler is a thin pass-through to a service helper; truncation
 * is the worker-side tool's responsibility (see `debugTools.ts`) so the
 * bridge stays a verbatim mirror of the backend payload and the bridge
 * tests can assert raw-shape behavior. `getContainerLog` drops null
 * fields so the wire-level optional contract is preserved across
 * Comlink.
 */
import type {
  ContainerState,
  ExecutionDetails,
  ExecutionState,
  ToolBridgeApi,
} from "@/agent/toolBridgeApi";
import {
  fetchContainerExecutionState,
  fetchContainerLog,
  fetchExecutionDetails,
  fetchExecutionState,
} from "@/services/executionService";

import type { BridgeDeps } from "./utils";
import { requireBackendUrl } from "./utils";

type DebugHandlers = Pick<
  ToolBridgeApi,
  | "getExecutionDetails"
  | "getExecutionState"
  | "getContainerState"
  | "getContainerLog"
>;

export function createDebugBridgeHandlers(deps: BridgeDeps): DebugHandlers {
  return {
    async getExecutionDetails(executionId): Promise<ExecutionDetails> {
      return fetchExecutionDetails(executionId, requireBackendUrl(deps));
    },

    async getExecutionState(executionId): Promise<ExecutionState> {
      return fetchExecutionState(executionId, requireBackendUrl(deps));
    },

    async getContainerState(executionId): Promise<ContainerState> {
      return fetchContainerExecutionState(executionId, requireBackendUrl(deps));
    },

    async getContainerLog(executionId) {
      const log = await fetchContainerLog(executionId, requireBackendUrl(deps));
      return {
        log_text: log.log_text ?? undefined,
        system_error_exception_full:
          log.system_error_exception_full ?? undefined,
        orchestration_error_message:
          log.orchestration_error_message ?? undefined,
      };
    },
  };
}
