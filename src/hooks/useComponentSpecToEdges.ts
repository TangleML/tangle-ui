import {
  type Edge,
  type EdgeChange,
  MarkerType,
  useEdgesState,
} from "@xyflow/react";
import { useEffect } from "react";

import { extractZIndexFromAnnotations } from "@/utils/annotations";
import {
  type ArgumentType,
  type ComponentSpec,
  type GraphInputArgument,
  type GraphSpec,
  isGraphImplementation,
  isGraphInputArgument,
  isSecretArgument,
  isTaskOutputArgument,
  type TaskOutputArgument,
  type TaskSpec,
} from "@/utils/componentSpec";
import {
  inputNameToNodeId,
  outputNameToNodeId,
  taskIdToNodeId,
} from "@/utils/nodes/nodeIdUtils";
import { isScalar } from "@/utils/types";

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
  }, [componentSpec]);

  return {
    edges: flowEdges,
    onEdgesChange: onFlowEdgesChange,
  };
};

const getEdges = (componentSpec: ComponentSpec) => {
  const taskEdges = createEdgesFromTaskSpec(componentSpec);
  const outputEdges = createOutputEdgesFromComponentSpec(componentSpec);
  return [...taskEdges, ...outputEdges];
};

const createEdgesFromTaskSpec = (componentSpec: ComponentSpec) => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return [];
  }

  const graphSpec = componentSpec.implementation.graph;

  const edges: Edge[] = Object.entries(graphSpec.tasks).flatMap(
    ([taskId, taskSpec]) => createEdgesForTask(taskId, taskSpec, componentSpec),
  );
  return edges;
};

const createEdgesForTask = (
  taskId: string,
  taskSpec: TaskSpec,
  componentSpec: ComponentSpec,
): Edge[] => {
  return Object.entries(taskSpec.arguments ?? {}).flatMap(
    ([inputName, argument]) =>
      createEdgeForArgument(taskId, inputName, argument, componentSpec),
  );
};

const createEdgeForArgument = (
  taskId: string,
  inputName: string,
  argument: ArgumentType,
  componentSpec: ComponentSpec,
): Edge[] => {
  if (isScalar(argument)) {
    return [];
  }

  if (!isGraphImplementation(componentSpec.implementation)) {
    throw new Error("ComponentSpec is not a graph implementation");
  }

  const graphSpec = componentSpec.implementation.graph;

  if (isTaskOutputArgument(argument)) {
    return [
      createTaskOutputEdge(taskId, inputName, argument.taskOutput, graphSpec),
    ];
  }

  if (isGraphInputArgument(argument)) {
    return [
      createGraphInputEdge(
        taskId,
        inputName,
        argument.graphInput,
        componentSpec,
      ),
    ];
  }

  if (isSecretArgument(argument)) {
    return [];
  }

  console.error("Impossible task input argument kind: ", argument);
  return [];
};

const createTaskOutputEdge = (
  taskId: string,
  inputName: string,
  taskOutput: TaskOutputArgument["taskOutput"],
  graphSpec: GraphSpec,
): Edge => {
  const targetTaskSpec = graphSpec.tasks[taskId];

  const sourceTaskSpec = graphSpec.tasks[taskOutput.taskId];
  const sourceZIndex = extractZIndexFromAnnotations(
    sourceTaskSpec?.annotations,
    "task",
  );
  const targetZIndex = extractZIndexFromAnnotations(
    targetTaskSpec.annotations,
    "task",
  );
  const edgeZIndex = Math.max(sourceZIndex, targetZIndex);

  return {
    id: `${taskOutput.taskId}_${taskOutput.outputName}-${taskId}_${inputName}`,
    source: taskIdToNodeId(taskOutput.taskId),
    sourceHandle: outputNameToNodeId(taskOutput.outputName),
    target: taskIdToNodeId(taskId),
    targetHandle: inputNameToNodeId(inputName),
    markerEnd: { type: MarkerType.Arrow },
    type: "customEdge",
    zIndex: edgeZIndex,
  };
};

const createGraphInputEdge = (
  taskId: string,
  inputName: string,
  graphInput: GraphInputArgument["graphInput"],
  componentSpec: ComponentSpec,
): Edge => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    throw new Error("ComponentSpec is not a graph implementation");
  }

  const graphSpec = componentSpec.implementation.graph;
  const targetTaskSpec = graphSpec.tasks[taskId];

  const inputSpec = componentSpec.inputs?.find(
    (input) => input.name === graphInput.inputName,
  );
  const sourceZIndex = extractZIndexFromAnnotations(
    inputSpec?.annotations,
    "input",
  );
  const targetZIndex = extractZIndexFromAnnotations(
    targetTaskSpec.annotations,
    "task",
  );
  const edgeZIndex = Math.max(sourceZIndex, targetZIndex);

  return {
    id: `Input_${graphInput.inputName}-${taskId}_${inputName}`,
    source: inputNameToNodeId(graphInput.inputName),
    sourceHandle: null,
    target: taskIdToNodeId(taskId),
    targetHandle: inputNameToNodeId(inputName),
    type: "customEdge",
    markerEnd: { type: MarkerType.Arrow },
    zIndex: edgeZIndex,
  };
};

const createOutputEdgesFromComponentSpec = (componentSpec: ComponentSpec) => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return [];
  }

  const graphSpec = componentSpec.implementation.graph;

  const outputEdges: Edge[] = Object.entries(graphSpec.outputValues ?? {}).map(
    ([outputName, argument]) => {
      const taskOutput = argument.taskOutput;
      const sourceTaskSpec = graphSpec.tasks[taskOutput.taskId];
      const outputSpec = componentSpec.outputs?.find(
        (output) => output.name === outputName,
      );

      const sourceZIndex = extractZIndexFromAnnotations(
        sourceTaskSpec?.annotations,
        "task",
      );
      const targetZIndex = extractZIndexFromAnnotations(
        outputSpec?.annotations,
        "output",
      );
      const edgeZIndex = Math.max(sourceZIndex, targetZIndex);

      const edge: Edge = {
        id: `${taskOutput.taskId}_${taskOutput.outputName}-Output_${outputName}`,
        source: taskIdToNodeId(taskOutput.taskId),
        sourceHandle: outputNameToNodeId(taskOutput.outputName),
        target: outputNameToNodeId(outputName),
        targetHandle: null,
        type: "customEdge",
        markerEnd: { type: MarkerType.Arrow },
        zIndex: edgeZIndex,
      };
      return edge;
    },
  );
  return outputEdges;
};

export default useComponentSpecToEdges;
