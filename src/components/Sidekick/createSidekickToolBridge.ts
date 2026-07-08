import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { validateSpec } from "@/models/componentSpec/validation/validateSpec";
import {
  type AiSpec,
  serializeSpecForAi,
} from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";
import { createComponentSearchBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/componentSearchBridge";
import { createDebugBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/debugBridge";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";

const NO_PIPELINE_SPEC: AiSpec = {
  name: "No pipeline open",
  inputs: [],
  outputs: [],
  tasks: [],
  bindings: [],
};

const OUTSIDE_EDITOR_ERROR =
  "Sidekick is outside the pipeline editor, so it cannot inspect, edit, submit, or debug a pipeline here. Open the pipeline editor for pipeline-specific actions.";

async function unsupported(): Promise<never> {
  throw new Error(OUTSIDE_EDITOR_ERROR);
}

export function createSidekickToolBridge(deps: BridgeDeps): ToolBridgeApi {
  const { getRunDetails, debugPipelineRun } = createRunBridgeHandlers(deps);
  const debugHandlers = createDebugBridgeHandlers(deps);
  const { searchComponents } = createComponentSearchBridgeHandlers(deps);

  return {
    async getPipelineState() {
      const spec = deps.getSpec();
      if (!spec) return NO_PIPELINE_SPEC;
      return serializeSpecForAi(spec, {
        activeSubgraphPath: deps.getActiveSubgraphPath(),
      });
    },
    async setPipelineName() {
      return { success: false };
    },
    async setPipelineDescription() {
      return { success: false };
    },
    async addTask() {
      return { success: false, error: OUTSIDE_EDITOR_ERROR };
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
      return { success: false, error: OUTSIDE_EDITOR_ERROR };
    },
    async deleteEdge() {
      return { success: false };
    },
    async setTaskArgument() {
      return { success: false, error: OUTSIDE_EDITOR_ERROR };
    },
    async createSubgraph() {
      return { success: false, error: OUTSIDE_EDITOR_ERROR };
    },
    async unpackSubgraph() {
      return { success: false };
    },
    async validatePipeline() {
      const spec = deps.getSpec();
      if (!spec) return { valid: true, issueCount: 0, issues: [] };
      const issues = validateSpec(spec);
      return {
        valid: issues.length === 0,
        issueCount: issues.length,
        issues: issues.map((issue) => ({
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          entityId: issue.entityId,
          issueCode: issue.issueCode,
        })),
      };
    },
    searchComponents,
    submitPipelineRun: unsupported,
    getRunDetails,
    debugPipelineRun,
    ...debugHandlers,
  };
}
