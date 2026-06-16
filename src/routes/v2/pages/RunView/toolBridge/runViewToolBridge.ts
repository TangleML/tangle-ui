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
import { validateSpec } from "@/models/componentSpec/validation/validateSpec";
import { serializeSpecForAi } from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";
import { createDebugBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/debugBridge";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";
import { requireSpec } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";

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
  | "validatePipeline"
  | "searchComponents"
>;

function createReadOnlyCsomHandlers(deps: BridgeDeps): ReadOnlyCsomHandlers {
  return {
    async getPipelineState() {
      return serializeSpecForAi(requireSpec(deps), {
        activeSubgraphPath: deps.getActiveSubgraphPath(),
      });
    },

    async validatePipeline(): Promise<ValidationResult> {
      const issues = validateSpec(requireSpec(deps));
      return {
        valid: issues.length === 0,
        issueCount: issues.length,
        issues: issues.map((i) => ({
          type: i.type,
          severity: i.severity,
          message: i.message,
          entityId: i.entityId,
          issueCode: i.issueCode,
        })),
      };
    },

    async searchComponents() {
      return {
        success: false,
        results: [],
        error: "Component search is only available in the editor.",
      };
    },

    async setPipelineName() {
      return { success: false };
    },
    async setPipelineDescription() {
      return { success: false };
    },
    async addTask() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async deleteTask() {
      return { success: false };
    },
    async renameTask() {
      return { success: false };
    },
    async addInput() {
      return { success: false, inputId: "", name: "" };
    },
    async deleteInput() {
      return { success: false };
    },
    async renameInput() {
      return { success: false };
    },
    async addOutput() {
      return { success: false, outputId: "", name: "" };
    },
    async deleteOutput() {
      return { success: false };
    },
    async renameOutput() {
      return { success: false };
    },
    async connectNodes() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async deleteEdge() {
      return { success: false };
    },
    async setTaskArgument() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async createSubgraph() {
      return { success: false, error: READ_ONLY_ERROR };
    },
    async unpackSubgraph() {
      return { success: false };
    },
  };
}

export function createRunViewToolBridge(deps: BridgeDeps): ToolBridgeApi {
  return {
    ...createReadOnlyCsomHandlers(deps),
    ...createRunBridgeHandlers(deps),
    ...createDebugBridgeHandlers(deps),
  };
}
