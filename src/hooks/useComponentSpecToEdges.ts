import {
  type Edge,
  type EdgeChange,
  MarkerType,
  useEdgesState,
} from "@xyflow/react";
import { useEffect } from "react";

import type {
  ArgumentType,
  ComponentSpec,
  GraphInputArgument,
  GraphSpec,
  TaskOutputArgument,
  TaskSpec,
} from "@/utils/componentSpec";
import {
  inputNameToNodeId,
  outputNameToNodeId,
  taskIdToNodeId,
} from "@/utils/nodes/nodeIdUtils";

const useComponentSpecToEdges = (
  componentSpec: ComponentSpec,
): {
  edges: Edge<any>[];
  onEdgesChange: (changes: EdgeChange[]) => void;
} => {
  const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState(
    getEdges(componentSpec),
  );

  useEffect(() => {
    const newEdges = getEdges(componentSpec);
    setFlowEdges(newEdges);
  }, [componentSpec, setFlowEdges]);

  return {
    edges: flowEdges,
    onEdgesChange: onFlowEdgesChange,
  };
};

const getEdges = (componentSpec: ComponentSpec) => {
  if (!("graph" in componentSpec.implementation)) {
    return [];
  }

  const graphSpec = componentSpec.implementation.graph;
  const taskEdges = createEdgesFromTaskSpec(graphSpec);
  const outputEdges = createOutputEdgesFromGraphSpec(graphSpec);
  return [...taskEdges, ...outputEdges];
};

const createEdgesFromTaskSpec = (graphSpec: GraphSpec) => {
  const edges: Edge[] = Object.entries(graphSpec.tasks).flatMap(
    ([taskId, taskSpec]) => createEdgesForTask(taskId, taskSpec),
  );
  return edges;
};

const createEdgesForTask = (taskId: string, taskSpec: TaskSpec): Edge[] => {
  return Object.entries(taskSpec.arguments ?? {}).flatMap(
    ([inputName, argument]) =>
      createEdgeForArgument(taskId, inputName, argument),
  );
};

const createEdgeForArgument = (
  taskId: string,
  inputName: string,
  argument: ArgumentType,
): Edge[] => {
  if (typeof argument === "string") {
    return [];
  }

  if ("taskOutput" in argument) {
    return [createTaskOutputEdge(taskId, inputName, argument.taskOutput)];
  }

  if ("graphInput" in argument) {
    return [createGraphInputEdge(taskId, inputName, argument.graphInput)];
  }

  console.error("Impossible task input argument kind: ", argument);
  return [];
};

const createTaskOutputEdge = (
  taskId: string,
  inputName: string,
  taskOutput: TaskOutputArgument["taskOutput"],
): Edge => {
  return {
    id: `${taskOutput.taskId}_${taskOutput.outputName}-${taskId}_${inputName}`,
    source: taskIdToNodeId(taskOutput.taskId),
    sourceHandle: outputNameToNodeId(taskOutput.outputName),
    target: taskIdToNodeId(taskId),
    targetHandle: inputNameToNodeId(inputName),
    markerEnd: { type: MarkerType.Arrow },
    type: "customEdge",
  };
};

const createGraphInputEdge = (
  taskId: string,
  inputName: string,
  graphInput: GraphInputArgument["graphInput"],
): Edge => {
  return {
    id: `Input_${graphInput.inputName}-${taskId}_${inputName}`,
    source: inputNameToNodeId(graphInput.inputName),
    sourceHandle: null,
    target: taskIdToNodeId(taskId),
    targetHandle: inputNameToNodeId(inputName),
    type: "customEdge",
    markerEnd: { type: MarkerType.Arrow },
  };
};

const createOutputEdgesFromGraphSpec = (graphSpec: GraphSpec) => {
  const outputEdges: Edge[] = Object.entries(graphSpec.outputValues ?? {}).map(
    ([outputName, argument]) => {
      const taskOutput = argument.taskOutput;
      const edge: Edge = {
        id: `${taskOutput.taskId}_${taskOutput.outputName}-Output_${outputName}`,
        source: taskIdToNodeId(taskOutput.taskId),
        sourceHandle: outputNameToNodeId(taskOutput.outputName),
        target: outputNameToNodeId(outputName),
        targetHandle: null,
        type: "customEdge",
        markerEnd: { type: MarkerType.Arrow },
      };
      return edge;
    },
  );
  return outputEdges;
};

export default useComponentSpecToEdges;
