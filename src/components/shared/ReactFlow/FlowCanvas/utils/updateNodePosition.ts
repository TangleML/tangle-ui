import type { Node } from "@xyflow/react";

import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import {
  nodeIdToInputName,
  nodeIdToOutputName,
  nodeIdToTaskId,
} from "@/utils/nodes/nodeIdUtils";
import { setPositionInAnnotations } from "@/utils/nodes/setPositionInAnnotations";

export const updateNodePositions = (
  updatedNodes: Node[],
  componentSpec: ComponentSpec,
) => {
  const newComponentSpec = { ...componentSpec };

  if (!isGraphImplementation(newComponentSpec.implementation)) {
    throw new Error("Component spec is not a graph");
  }

  const updatedGraphSpec = {
    ...newComponentSpec.implementation.graph,
  };

  for (const node of updatedNodes) {
    const newPosition = {
      x: node.position.x,
      y: node.position.y,
    };

    if (node.type === "task") {
      const taskId = nodeIdToTaskId(node.id);
      if (updatedGraphSpec.tasks[taskId]) {
        const taskSpec = { ...updatedGraphSpec.tasks[taskId] };

        const annotations = taskSpec.annotations || {};

        const updatedAnnotations = setPositionInAnnotations(
          annotations,
          newPosition,
        );

        const newTaskSpec = {
          ...taskSpec,
          annotations: updatedAnnotations,
        };

        updatedGraphSpec.tasks[taskId] = newTaskSpec;

        newComponentSpec.implementation.graph = updatedGraphSpec;
      }
    } else if (node.type === "input") {
      const inputName = nodeIdToInputName(node.id);
      const inputs = [...(newComponentSpec.inputs || [])];
      const inputIndex = inputs.findIndex((input) => input.name === inputName);

      if (inputIndex >= 0) {
        const annotations = inputs[inputIndex].annotations || {};

        const updatedAnnotations = setPositionInAnnotations(
          annotations,
          newPosition,
        );

        inputs[inputIndex] = {
          ...inputs[inputIndex],
          annotations: updatedAnnotations,
        };

        newComponentSpec.inputs = inputs;
      }
    } else if (node.type === "output") {
      const outputName = nodeIdToOutputName(node.id);
      const outputs = [...(newComponentSpec.outputs || [])];
      const outputIndex = outputs.findIndex(
        (output) => output.name === outputName,
      );

      if (outputIndex >= 0) {
        const annotations = outputs[outputIndex].annotations || {};

        const updatedAnnotations = setPositionInAnnotations(
          annotations,
          newPosition,
        );

        outputs[outputIndex] = {
          ...outputs[outputIndex],
          annotations: updatedAnnotations,
        };

        newComponentSpec.outputs = outputs;
      }
    } else if (node.type === "comment") {
      if (newComponentSpec.metadata?.annotations?.comments) {
        const comments = [...newComponentSpec.metadata.annotations.comments];
        const commentIndex = comments.findIndex(
          (comment) => comment.id === node.id,
        );

        if (commentIndex >= 0) {
          comments[commentIndex] = {
            ...comments[commentIndex],
            position: newPosition,
          };

          newComponentSpec.metadata.annotations.comments = comments;
        }
      }
    }
  }

  return newComponentSpec;
};
