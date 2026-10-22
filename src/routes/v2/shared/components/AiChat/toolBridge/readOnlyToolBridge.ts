import type { ToolBridgeApi, ValidationResult } from "@/agent/toolBridgeApi";
import { serializeSpecForAi } from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";

import { createDebugBridgeHandlers } from "./debugBridge";
import { createRunBridgeHandlers } from "./runBridge";
import { createSubgraphBridgeHandlers } from "./subgraphBridge";
import type { BridgeDeps } from "./utils";
import { requireActiveSpec, requireSpec, toValidationResult } from "./utils";

const READ_ONLY_ERROR =
  "This is a read-only view — the pipeline spec cannot be edited here.";

type ReadOnlyCsomHandlers = Pick<
  ToolBridgeApi,
  | "getPipelineState"
  | "setPipelineName"
  | "setPipelineDescription"
  | "setPipelineNotes"
  | "setPipelineTags"
  | "setRunNameTemplate"
  | "addTask"
  | "deleteTask"
  | "renameTask"
  | "setTaskColor"
  | "addInput"
  | "deleteInput"
  | "renameInput"
  | "updateInput"
  | "addOutput"
  | "deleteOutput"
  | "renameOutput"
  | "updateOutput"
  | "connectNodes"
  | "deleteEdge"
  | "setTaskArgument"
  | "createSubgraph"
  | "unpackSubgraph"
  | "addStickyNote"
  | "updateStickyNote"
  | "deleteStickyNote"
  | "moveNode"
  | "autoLayout"
  | "validatePipeline"
  | "searchComponents"
>;

export function createReadOnlyCsomHandlers(
  deps: BridgeDeps,
): ReadOnlyCsomHandlers {
  return {
    async getPipelineState() {
      return serializeSpecForAi(requireSpec(deps), {
        activeSubgraphPath: deps.getActiveSubgraphPath(),
        activeSubgraphTaskId: deps.getActiveSubgraphTaskId(),
        activeSpec: requireActiveSpec(deps),
      });
    },

    async validatePipeline(): Promise<ValidationResult> {
      return toValidationResult(requireSpec(deps));
    },

    async searchComponents() {
      return {
        success: false,
        results: [],
        error: "Component search is only available in an editable pipeline.",
      };
    },

    async setPipelineName() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async setPipelineDescription() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async setPipelineNotes() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async setPipelineTags() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async setRunNameTemplate() {
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
    async setTaskColor() {
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
    async updateInput() {
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
    async updateOutput() {
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
    async addStickyNote() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async updateStickyNote() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async deleteStickyNote() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async moveNode() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async autoLayout() {
      return { success: false, error: READ_ONLY_ERROR };
    },
  };
}

/** Inspection tools for a pipeline whose source cannot be edited or run. */
export function createReadOnlyToolBridge(deps: BridgeDeps): ToolBridgeApi {
  return {
    ...createReadOnlyCsomHandlers(deps),
    ...createSubgraphBridgeHandlers(deps),
    ...createRunBridgeHandlers(deps),
    ...createDebugBridgeHandlers(deps),
    async submitPipelineRun() {
      return {
        success: false,
        error:
          "Runs cannot be submitted from a read-only pipeline. Clone it first.",
      };
    },
  };
}
