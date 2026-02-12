import type { Connection } from "@xyflow/react";

import {
  AGGREGATOR_ADD_INPUT_HANDLE_ID,
  createAggregatorInput,
  getNextAggregatorInputName,
} from "@/utils/aggregatorInputs";
import { isPipelineAggregator } from "@/utils/annotations";
import type {
  ComponentReference,
  ComponentSpec,
  GraphSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import { isTaskOutputArgument } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import { nodeIdToTaskId } from "@/utils/nodes/nodeIdUtils";
import { componentSpecToText } from "@/utils/yaml";

import { handleConnection } from "./handleConnection";

export const handleAggregatorConnection = (
  graphSpec: GraphSpec,
  connection: Connection,
  updateNodeInternals?: (nodeId: string) => void,
): { graphSpec: GraphSpec; shouldCreateEdge: boolean; redirectedConnection?: Connection } => {
  const targetHandleId = connection.targetHandle;

  if (targetHandleId !== AGGREGATOR_ADD_INPUT_HANDLE_ID) {
    return { 
      graphSpec: handleConnection(graphSpec, connection),
      shouldCreateEdge: false,
    };
  }

  const targetTaskId = nodeIdToTaskId(connection.target);
  const targetTask = graphSpec.tasks[targetTaskId];

  if (!targetTask?.componentRef?.spec) {
    return { graphSpec, shouldCreateEdge: false };
  }

  const isAggregator = isPipelineAggregator(
    targetTask.componentRef.spec.metadata?.annotations,
  );

  if (!isAggregator) {
    return { graphSpec, shouldCreateEdge: false };
  }

  // Check if this source is already connected to any agg_* input
  const sourceNode = connection.source;
  const sourceHandle = connection.sourceHandle;
  
  // Only check for duplicates if we have valid source information
  if (sourceNode) {
    const currentArguments = targetTask.arguments || {};
    const aggregatorInputs = Object.entries(currentArguments).filter(([key]) =>
      key.startsWith('agg_')
    );

    const isDuplicateSource = aggregatorInputs.some(([, value]) => {
      // Check if it's a task output argument
      if (isTaskOutputArgument(value)) {
        // Only compare if the new connection is also a task output (has sourceHandle)
        if (sourceHandle) {
          const existingSourceTaskId = value.taskOutput.taskId;
          const existingSourceOutputName = value.taskOutput.outputName;
          const newSourceTaskId = nodeIdToTaskId(sourceNode);
          const newSourceOutputName = sourceHandle.replace(/^output_/, '');
          
          return existingSourceTaskId === newSourceTaskId && 
                 existingSourceOutputName === newSourceOutputName;
        }
      } else if (value && typeof value === 'object' && 'graphInput' in value) {
        // It's a graph input argument
        // Only compare if the new connection is also a graph input (no sourceHandle)
        if (!sourceHandle && sourceNode.startsWith('input_')) {
          const existingInputName = value.graphInput.inputName;
          const newInputName = sourceNode.replace(/^input_/, '');
          
          return existingInputName === newInputName;
        }
      }
      
      return false;
    });

    // If this source is already connected, don't add a new input
    if (isDuplicateSource) {
      console.warn('⚠️ This source is already connected to the Pipeline Aggregator. Connection rejected.');
      return { graphSpec, shouldCreateEdge: false };
    }
  }

  const currentInputs = targetTask.componentRef.spec.inputs || [];
  const newInputName = getNextAggregatorInputName(currentInputs);
  const newInput = createAggregatorInput(newInputName);

  // Deep clone the spec to ensure this aggregator has an independent copy
  const clonedSpec: ComponentSpec = deepClone(targetTask.componentRef.spec);
  const updatedInputs = [...(clonedSpec.inputs || []), newInput];

  // Reconstruct spec with proper key ordering (inputs before outputs)
  const orderedSpec: ComponentSpec = {
    name: clonedSpec.name,
    ...(clonedSpec.description && { description: clonedSpec.description }),
    ...(clonedSpec.metadata && { metadata: clonedSpec.metadata }),
    inputs: updatedInputs,
    ...(clonedSpec.outputs && { outputs: clonedSpec.outputs }),
    implementation: clonedSpec.implementation,
  };

  // Update the text field to reflect the new spec
  const updatedText = componentSpecToText(orderedSpec);

  const updatedComponentRef: ComponentReference = {
    ...targetTask.componentRef,
    spec: orderedSpec,
    text: updatedText,
  };

  const updatedTask: TaskSpec = {
    ...targetTask,
    componentRef: updatedComponentRef,
  };

  const graphSpecWithNewInput: GraphSpec = {
    ...graphSpec,
    tasks: {
      ...graphSpec.tasks,
      [targetTaskId]: updatedTask,
    },
  };

  // Update node internals immediately if callback is provided
  if (updateNodeInternals) {
    updateNodeInternals(connection.target);
  }

  // Create the redirected connection for React Flow to use
  const redirectedConnection: Connection = {
    ...connection,
    targetHandle: `input_${newInputName}`,
  };

  return { 
    graphSpec: graphSpecWithNewInput, 
    shouldCreateEdge: true,
    redirectedConnection,
  };
};
