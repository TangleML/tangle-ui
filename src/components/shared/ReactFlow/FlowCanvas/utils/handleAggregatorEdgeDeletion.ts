import type { Edge } from "@xyflow/react";

import { isPipelineAggregator } from "@/utils/annotations";
import type {
  ComponentReference,
  ComponentSpec,
  GraphImplementation,
  TaskSpec,
} from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import { nodeIdToTaskId } from "@/utils/nodes/nodeIdUtils";

export const handleAggregatorEdgeDeletion = (
  componentSpec: ComponentSpec,
  deletedEdges: Edge[],
): ComponentSpec => {
  const graphSpec = (componentSpec.implementation as GraphImplementation)?.graph;

  if (!graphSpec?.tasks) {
    return componentSpec;
  }

  let updatedGraphSpec = graphSpec;

  for (const edge of deletedEdges) {
    const targetTaskId = nodeIdToTaskId(edge.target);
    const targetTask = updatedGraphSpec.tasks[targetTaskId];

    if (!targetTask?.componentRef?.spec) {
      continue;
    }

    const isAggregator = isPipelineAggregator(
      targetTask.componentRef.spec.metadata?.annotations,
    );

    if (!isAggregator) {
      continue;
    }

    const targetHandle = edge.targetHandle?.replace(/^input_/, "");

    if (!targetHandle || !targetHandle.startsWith("agg_")) {
      continue;
    }

    // Deep clone the spec to ensure this aggregator has an independent copy
    const clonedSpec: ComponentSpec = deepClone(targetTask.componentRef.spec);
    clonedSpec.inputs = (clonedSpec.inputs || []).filter(
      (input) => input.name !== targetHandle,
    );

    const updatedArguments = { ...targetTask.arguments };
    delete updatedArguments[targetHandle];

    const updatedComponentRef: ComponentReference = {
      ...targetTask.componentRef,
      spec: clonedSpec,
    };

    const updatedTask: TaskSpec = {
      ...targetTask,
      componentRef: updatedComponentRef,
      arguments: updatedArguments,
    };

    updatedGraphSpec = {
      ...updatedGraphSpec,
      tasks: {
        ...updatedGraphSpec.tasks,
        [targetTaskId]: updatedTask,
      },
    };
  }

  return {
    ...componentSpec,
    implementation: {
      ...componentSpec.implementation,
      graph: updatedGraphSpec,
    },
  };
};
