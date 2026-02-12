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
import { componentSpecToText } from "@/utils/yaml";

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
    const filteredInputs = (clonedSpec.inputs || []).filter(
      (input) => input.name !== targetHandle,
    );

    // Reconstruct spec with proper key ordering (inputs before outputs)
    const orderedSpec: ComponentSpec = {
      name: clonedSpec.name,
      ...(clonedSpec.description && { description: clonedSpec.description }),
      ...(clonedSpec.metadata && { metadata: clonedSpec.metadata }),
      inputs: filteredInputs,
      ...(clonedSpec.outputs && { outputs: clonedSpec.outputs }),
      implementation: clonedSpec.implementation,
    };

    // Update the text field to reflect the new spec
    const updatedText = componentSpecToText(orderedSpec);

    const updatedArguments = { ...targetTask.arguments };
    delete updatedArguments[targetHandle];

    const updatedComponentRef: ComponentReference = {
      ...targetTask.componentRef,
      spec: orderedSpec,
      text: updatedText,
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
