import { extractPositionFromAnnotations } from "@/utils/annotations";
import type { ComponentSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

import {
  getDownstreamTaskNodesConnectedToTask,
  getOutputNodesConnectedToTask,
} from "../../graphUtils";
import {
  copyOutputValues,
  reconnectDownstreamOutputs,
  reconnectDownstreamTasks,
  reconnectUpstreamInputsAndTasks,
  unpackFlexNodes,
  unpackInputs,
  unpackOutputs,
  unpackTasks,
} from "./helpers";

export const unpackSubgraph = (
  subgraphTaskId: string,
  componentSpec: ComponentSpec,
): ComponentSpec => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return componentSpec;
  }

  const graphSpec = componentSpec.implementation.graph;
  const taskSpec = graphSpec.tasks[subgraphTaskId];
  const subgraphSpec = taskSpec.componentRef.spec;
  const subgraphArguments = taskSpec.arguments || {};

  if (!subgraphSpec || !isGraphImplementation(subgraphSpec.implementation)) {
    return componentSpec;
  }

  const subgraphGraphSpec = subgraphSpec.implementation.graph;

  const subgraphPosition = extractPositionFromAnnotations(taskSpec.annotations);

  const outputNodesConnectedToSubgraph = getOutputNodesConnectedToTask(
    subgraphTaskId,
    graphSpec,
  );
  const tasksConnectedDownstreamFromSubgraph =
    getDownstreamTaskNodesConnectedToTask(subgraphTaskId, graphSpec);

  let updatedComponentSpec = componentSpec;

  // Unpack flex Nodes
  const specAfterFlexNodes = unpackFlexNodes(
    subgraphSpec,
    subgraphPosition,
    updatedComponentSpec,
  );
  updatedComponentSpec = specAfterFlexNodes;

  // Unpack inputs
  const { spec: specAfterInputs, inputNameMap } = unpackInputs(
    subgraphSpec,
    subgraphPosition,
    subgraphArguments,
    updatedComponentSpec,
  );
  updatedComponentSpec = specAfterInputs;

  // Unpack outputs
  const { spec: specAfterOutputs, outputNameMap } = unpackOutputs(
    subgraphSpec,
    subgraphPosition,
    updatedComponentSpec,
    outputNodesConnectedToSubgraph,
    tasksConnectedDownstreamFromSubgraph,
  );
  updatedComponentSpec = specAfterOutputs;

  // Unpack tasks
  const { spec: specAfterTasks, taskIdMap } = unpackTasks(
    subgraphSpec,
    subgraphPosition,
    updatedComponentSpec,
    inputNameMap,
  );
  updatedComponentSpec = specAfterTasks;

  // Copy output values
  updatedComponentSpec = copyOutputValues(
    subgraphSpec,
    updatedComponentSpec,
    outputNameMap,
    taskIdMap,
    outputNodesConnectedToSubgraph,
    tasksConnectedDownstreamFromSubgraph,
  );

  // Reconnect external nodes - Upstream Inputs and Tasks
  updatedComponentSpec = reconnectUpstreamInputsAndTasks(
    subgraphGraphSpec,
    subgraphTaskId,
    graphSpec,
    updatedComponentSpec,
    taskIdMap,
  );

  // Reconnect to external nodes - Downstream Outputs
  updatedComponentSpec = reconnectDownstreamOutputs(
    subgraphGraphSpec,
    subgraphTaskId,
    graphSpec,
    updatedComponentSpec,
    taskIdMap,
  );

  // Reconnect to external nodes - Downstream Tasks
  updatedComponentSpec = reconnectDownstreamTasks(
    subgraphGraphSpec,
    subgraphTaskId,
    graphSpec,
    updatedComponentSpec,
    taskIdMap,
  );

  return updatedComponentSpec;
};
