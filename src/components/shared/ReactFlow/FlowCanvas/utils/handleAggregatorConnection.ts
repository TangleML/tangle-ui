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
import { deepClone } from "@/utils/deepClone";
import { nodeIdToTaskId } from "@/utils/nodes/nodeIdUtils";

import { handleConnection } from "./handleConnection";

export const handleAggregatorConnection = (
  graphSpec: GraphSpec,
  connection: Connection,
): { graphSpec: GraphSpec } => {
  const targetHandleId = connection.targetHandle;

  if (targetHandleId !== AGGREGATOR_ADD_INPUT_HANDLE_ID) {
    return { graphSpec: handleConnection(graphSpec, connection) };
  }

  const targetTaskId = nodeIdToTaskId(connection.target);
  const targetTask = graphSpec.tasks[targetTaskId];

  if (!targetTask?.componentRef?.spec) {
    return { graphSpec };
  }

  const isAggregator = isPipelineAggregator(
    targetTask.componentRef.spec.metadata?.annotations,
  );

  if (!isAggregator) {
    return { graphSpec };
  }

  const currentInputs = targetTask.componentRef.spec.inputs || [];
  const newInputName = getNextAggregatorInputName(currentInputs);
  const newInput = createAggregatorInput(newInputName);

  // Deep clone the spec to ensure this aggregator has an independent copy
  const clonedSpec: ComponentSpec = deepClone(targetTask.componentRef.spec);
  clonedSpec.inputs = [...(clonedSpec.inputs || []), newInput];

  const updatedComponentRef: ComponentReference = {
    ...targetTask.componentRef,
    spec: clonedSpec,
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

  // Create the connection immediately - React Flow will handle the timing
  const redirectedConnection: Connection = {
    ...connection,
    targetHandle: `input_${newInputName}`,
  };

  return { graphSpec: handleConnection(graphSpecWithNewInput, redirectedConnection) };
};
