import type { Connection } from "@xyflow/react";

import {
  AGGREGATOR_ADD_INPUT_HANDLE_ID,
  createAggregatorInput,
  getNextAggregatorInputName,
} from "@/utils/aggregatorInputs";
import { isPipelineAggregator } from "@/utils/annotations";
import type {
  ComponentReference,
  GraphSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import { nodeIdToTaskId } from "@/utils/nodes/nodeIdUtils";

import { handleConnection } from "./handleConnection";

export const handleAggregatorConnection = (
  graphSpec: GraphSpec,
  connection: Connection,
): GraphSpec => {
  const targetHandleId = connection.targetHandle;

  if (targetHandleId !== AGGREGATOR_ADD_INPUT_HANDLE_ID) {
    return handleConnection(graphSpec, connection);
  }

  const targetTaskId = nodeIdToTaskId(connection.target);
  const targetTask = graphSpec.tasks[targetTaskId];

  if (!targetTask?.componentRef?.spec) {
    return graphSpec;
  }

  const isAggregator = isPipelineAggregator(
    targetTask.componentRef.spec.metadata?.annotations,
  );

  if (!isAggregator) {
    return graphSpec;
  }

  const currentInputs = targetTask.componentRef.spec.inputs || [];
  const newInputName = getNextAggregatorInputName(currentInputs);
  const newInput = createAggregatorInput(newInputName);

  const updatedComponentRef: ComponentReference = {
    ...targetTask.componentRef,
    spec: {
      ...targetTask.componentRef.spec,
      inputs: [...currentInputs, newInput],
    },
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

  const redirectedConnection: Connection = {
    ...connection,
    targetHandle: `input_${newInputName}`,
  };

  return handleConnection(graphSpecWithNewInput, redirectedConnection);
};
