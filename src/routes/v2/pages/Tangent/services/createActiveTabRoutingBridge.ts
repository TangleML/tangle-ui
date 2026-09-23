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
    "No pipeline or run is open in the workarea. Open one first (open_workarea_target), then try again.",
  );
}

function createRoutingBridge(resolve: () => ToolBridgeApi): ToolBridgeApi {
  return {
    getPipelineState: () => resolve().getPipelineState(),
    getSubgraphState: (taskEntityId) =>
      resolve().getSubgraphState(taskEntityId),
    setPipelineName: (name) => resolve().setPipelineName(name),
    setPipelineDescription: (description) =>
      resolve().setPipelineDescription(description),
    setPipelineNotes: (notes, expectedSubgraphTaskId) =>
      resolve().setPipelineNotes(notes, expectedSubgraphTaskId),
    setPipelineTags: (tags, expectedSubgraphTaskId) =>
      resolve().setPipelineTags(tags, expectedSubgraphTaskId),
    setRunNameTemplate: (template, expectedSubgraphTaskId) =>
      resolve().setRunNameTemplate(template, expectedSubgraphTaskId),
    addTask: (args) => resolve().addTask(args),
    deleteTask: (entityId) => resolve().deleteTask(entityId),
    renameTask: (entityId, newName) => resolve().renameTask(entityId, newName),
    setTaskColor: (taskEntityIds, color) =>
      resolve().setTaskColor(taskEntityIds, color),
    addInput: (args) => resolve().addInput(args),
    deleteInput: (entityId) => resolve().deleteInput(entityId),
    renameInput: (entityId, newName) =>
      resolve().renameInput(entityId, newName),
    updateInput: (entityId, updates) =>
      resolve().updateInput(entityId, updates),
    addOutput: (args) => resolve().addOutput(args),
    deleteOutput: (entityId) => resolve().deleteOutput(entityId),
    renameOutput: (entityId, newName) =>
      resolve().renameOutput(entityId, newName),
    updateOutput: (entityId, updates) =>
      resolve().updateOutput(entityId, updates),
    addStickyNote: (args) => resolve().addStickyNote(args),
    updateStickyNote: (noteId, updates) =>
      resolve().updateStickyNote(noteId, updates),
    deleteStickyNote: (noteId) => resolve().deleteStickyNote(noteId),
    moveNode: (entityId, position) => resolve().moveNode(entityId, position),
    autoLayout: (algorithm) => resolve().autoLayout(algorithm),
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

export function createActiveTabRoutingBridge(
  getBridge: () => ToolBridgeApi | undefined,
): ToolBridgeApi {
  return createRoutingBridge(() => getBridge() ?? noActivePipeline());
}

export interface AgentTargetRouter {
  bridgeFor(agentId: string): ToolBridgeApi;
  pinTurn(agentId: string): void;
  forget(agentId: string): void;
}

/**
 * Per-agent bridges whose target is frozen for the duration of a turn.
 *
 * Re-targeting between turns is the point of the router — the agent acts on
 * the pipeline the person is looking at. Re-targeting *during* one is a bug:
 * an agent can read tab A, the person switches to B while it reasons, and its
 * next mutation lands in B. Pinning at the turn boundary keeps a turn on the
 * tab it started against.
 *
 * The pin is per agent because one worker hosts several and their turns are
 * only serialized per `agentId`, so two can be in flight at once.
 */
export function createAgentTargetRouter(
  getBridge: () => ToolBridgeApi | undefined,
): AgentTargetRouter {
  const pinned = new Map<string, ToolBridgeApi | undefined>();

  return {
    bridgeFor(agentId) {
      return createRoutingBridge(
        () => pinned.get(agentId) ?? getBridge() ?? noActivePipeline(),
      );
    },
    pinTurn(agentId) {
      pinned.set(agentId, getBridge());
    },
    forget(agentId) {
      pinned.delete(agentId);
    },
  };
}
