import type { ToolBridgeApi, ValidationResult } from "@/agent/toolBridgeApi";
import { serializeSpecForAi } from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";

import { createDebugBridgeHandlers } from "./debugBridge";
import { createRunBridgeHandlers } from "./runBridge";
import { createSubgraphBridgeHandlers } from "./subgraphBridge";
import type { BridgeDeps } from "./utils";
import { requireActiveSpec, requireSpec, toValidationResult } from "./utils";

async function denyEdit(): ReturnType<ToolBridgeApi["setPipelineName"]> {
  return {
    success: false,
    error:
      "This is a read-only view — the pipeline spec cannot be edited here.",
  };
}

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

    setPipelineName: denyEdit,
    setPipelineDescription: denyEdit,
    setPipelineNotes: denyEdit,
    setPipelineTags: denyEdit,
    setRunNameTemplate: denyEdit,
    addTask: denyEdit,
    deleteTask: denyEdit,
    renameTask: denyEdit,
    setTaskColor: denyEdit,
    addInput: denyEdit,
    deleteInput: denyEdit,
    renameInput: denyEdit,
    updateInput: denyEdit,
    addOutput: denyEdit,
    deleteOutput: denyEdit,
    renameOutput: denyEdit,
    updateOutput: denyEdit,
    connectNodes: denyEdit,
    deleteEdge: denyEdit,
    setTaskArgument: denyEdit,
    createSubgraph: denyEdit,
    unpackSubgraph: denyEdit,
    addStickyNote: denyEdit,
    updateStickyNote: denyEdit,
    deleteStickyNote: denyEdit,
    moveNode: denyEdit,
    autoLayout: denyEdit,
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
