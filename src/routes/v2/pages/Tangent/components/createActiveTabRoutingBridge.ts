/**
 * A {@link ToolBridgeApi} that forwards every call to the pipeline tab that is
 * currently active in the Dynamic Workarea.
 *
 * The project-level editor agent (spawns not bound to a specific tab's remote
 * environment) drives "the pipeline in front of the user". Each embedded editor
 * publishes its own bridge; this router looks up the active tab's bridge on
 * every call, so switching tabs re-targets the agent without rebuilding the
 * worker connection. It throws a clear error when no pipeline is active so the
 * agent can tell the user to open one.
 */
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";

function noActivePipeline(): never {
  throw new Error(
    "No pipeline is open in the workarea. Open a pipeline first (open_pipeline), then try again.",
  );
}

export function createActiveTabRoutingBridge(
  getBridge: () => ToolBridgeApi | undefined,
): ToolBridgeApi {
  function resolve(): ToolBridgeApi {
    return getBridge() ?? noActivePipeline();
  }

  return {
    getPipelineState: () => resolve().getPipelineState(),
    setPipelineName: (name) => resolve().setPipelineName(name),
    setPipelineDescription: (description) =>
      resolve().setPipelineDescription(description),
    addTask: (args) => resolve().addTask(args),
    deleteTask: (entityId) => resolve().deleteTask(entityId),
    renameTask: (entityId, newName) => resolve().renameTask(entityId, newName),
    addInput: (args) => resolve().addInput(args),
    deleteInput: (entityId) => resolve().deleteInput(entityId),
    renameInput: (entityId, newName) =>
      resolve().renameInput(entityId, newName),
    addOutput: (args) => resolve().addOutput(args),
    deleteOutput: (entityId) => resolve().deleteOutput(entityId),
    renameOutput: (entityId, newName) =>
      resolve().renameOutput(entityId, newName),
    connectNodes: (args) => resolve().connectNodes(args),
    deleteEdge: (entityId) => resolve().deleteEdge(entityId),
    setTaskArgument: (taskEntityId, inputName, value) =>
      resolve().setTaskArgument(taskEntityId, inputName, value),
    createSubgraph: (taskEntityIds, subgraphName) =>
      resolve().createSubgraph(taskEntityIds, subgraphName),
    unpackSubgraph: (taskEntityId) => resolve().unpackSubgraph(taskEntityId),
    validatePipeline: () => resolve().validatePipeline(),
    searchComponents: (args) => resolve().searchComponents(args),
    submitPipelineRun: () => resolve().submitPipelineRun(),
    getRunDetails: (runId) => resolve().getRunDetails(runId),
    getExecutionDetails: (executionId) =>
      resolve().getExecutionDetails(executionId),
    getExecutionState: (executionId) =>
      resolve().getExecutionState(executionId),
    getContainerState: (executionId) =>
      resolve().getContainerState(executionId),
    getContainerLog: (executionId) => resolve().getContainerLog(executionId),
    debugPipelineRun: (runId) => resolve().debugPipelineRun(runId),
  };
}
