/**
 * Read-only tool bridge for the RunView AI assistant.
 *
 * RunView inspects a completed pipeline run, so its bridge composes the
 * shared run-lifecycle and debug handlers but exposes a read-only CSOM
 * slice: `getPipelineState` / `validatePipeline` work against the live
 * spec, while every spec-mutating method short-circuits with an error.
 * This satisfies the full `ToolBridgeApi` contract without depending on
 * the Editor's spec-mutation actions or an undo store.
 */
import type { ToolBridgeApi, ValidationResult } from "@/agent/toolBridgeApi";
import { serializeSpecForAi } from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";
import { createDebugBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/debugBridge";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import { createSubgraphBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/subgraphBridge";
import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";
import {
  requireSpec,
  toValidationResult,
} from "@/routes/v2/shared/components/AiChat/toolBridge/utils";

const READ_ONLY_ERROR =
  "This is a read-only run view — the pipeline spec cannot be edited here.";

type ReadOnlyCsomHandlers = Pick<
  ToolBridgeApi,
  | "getPipelineState"
  | "setPipelineName"
  | "setPipelineDescription"
  | "addTask"
  | "deleteTask"
  | "renameTask"
  | "addInput"
  | "deleteInput"
  | "renameInput"
  | "addOutput"
  | "deleteOutput"
  | "renameOutput"
  | "connectNodes"
  | "deleteEdge"
  | "setTaskArgument"
  | "createSubgraph"
  | "unpackSubgraph"
  | "autoLayout"
  | "validatePipeline"
  | "searchComponents"
>;

function createReadOnlyCsomHandlers(deps: BridgeDeps): ReadOnlyCsomHandlers {
  return {
    async getPipelineState() {
      return serializeSpecForAi(requireSpec(deps), {
        activeSubgraphPath: deps.getActiveSubgraphPath(),
        activeSubgraphTaskId: deps.getActiveSubgraphTaskId(),
      });
    },

    async validatePipeline(): Promise<ValidationResult> {
      return toValidationResult(requireSpec(deps));
    },

    async searchComponents() {
      return {
        success: false,
        results: [],
        error: "Component search is only available in the editor.",
      };
    },

    async setPipelineName() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async setPipelineDescription() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async addTask() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async deleteTask() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async renameTask() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async addInput() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async deleteInput() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async renameInput() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async addOutput() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async deleteOutput() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async renameOutput() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async connectNodes() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async deleteEdge() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async setTaskArgument() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async createSubgraph() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async unpackSubgraph() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async autoLayout() {
      return { success: false, error: READ_ONLY_ERROR };
    },
  };
}

export function createRunViewToolBridge(deps: BridgeDeps): ToolBridgeApi {
  return {
    ...createReadOnlyCsomHandlers(deps),
    ...createSubgraphBridgeHandlers(deps),
    ...createRunBridgeHandlers(deps),
    ...createDebugBridgeHandlers(deps),
  };
}
