import type { Connection, Handle } from "@xyflow/react";

import type {
  ComponentReference,
  ComponentSpec,
  TaskSpec,
  TypeSpecType,
} from "@/utils/componentSpec";
import { DEFAULT_NODE_DIMENSIONS } from "@/utils/constants";
import {
  inputNameToNodeId,
  nodeIdToTaskId,
  outputNameToNodeId,
  taskIdToNodeId,
} from "@/utils/nodes/nodeIdUtils";

import addTask from "./addTask";
import { handleConnection } from "./handleConnection";

type AddAndConnectNodeParams = {
  componentRef: ComponentReference;
  fromHandle: Handle | null;
  position: { x: number; y: number };
  componentSpec: ComponentSpec;
};

export function addAndConnectNode({
  componentRef,
  fromHandle,
  position,
  componentSpec,
}: AddAndConnectNodeParams): ComponentSpec {
  // 1. Add the new node
  const taskSpec: TaskSpec = {
    annotations: {},
    componentRef: { ...componentRef },
  };

  if (!("graph" in componentSpec.implementation)) {
    return componentSpec;
  }

  const oldGraphSpec = componentSpec.implementation.graph;

  const fromHandleId = fromHandle?.id;
  const fromHandleType = fromHandleId?.startsWith("input") ? "input" : "output";

  const adjustedPosition =
    fromHandleType === "input"
      ? { ...position, x: position.x - DEFAULT_NODE_DIMENSIONS.w }
      : position;

  const { spec: newComponentSpec } = addTask(
    "task",
    taskSpec,
    adjustedPosition,
    componentSpec,
  );

  // 2. Find the new node
  if (!("graph" in newComponentSpec.implementation)) {
    return newComponentSpec;
  }

  const graphSpec = newComponentSpec.implementation.graph;

  const newTaskId = Object.keys(graphSpec.tasks).find(
    (key) => !(key in oldGraphSpec.tasks),
  );

  if (!newTaskId) {
    return newComponentSpec;
  }

  const newNodeId = taskIdToNodeId(newTaskId);

  // 3. Determine the connection data type and find the first matching handle on the new node
  if (!fromHandle) {
    return newComponentSpec;
  }

  const fromTaskId = nodeIdToTaskId(fromHandle.nodeId);

  const fromTaskSpec = graphSpec.tasks[fromTaskId];
  const fromComponentSpec = fromTaskSpec?.componentRef.spec;

  const fromNodeId = fromHandle.nodeId;

  const fromHandleName = fromHandleId?.replace(`${fromHandleType}_`, "");

  let connectionType: TypeSpecType | undefined;
  if (fromHandleType === "input") {
    connectionType = fromComponentSpec?.inputs?.find(
      (io) => io.name === fromHandleName,
    )?.type;
  } else if (fromHandleType === "output") {
    connectionType = fromComponentSpec?.outputs?.find(
      (io) => io.name === fromHandleName,
    )?.type;
  }

  // Find the first matching handle on the new node
  const toHandleType = fromHandleType === "input" ? "output" : "input";

  let targetHandleId: string | undefined;

  if (toHandleType === "input") {
    const handleName = componentRef.spec?.inputs?.find(
      (io) => io.type === connectionType,
    )?.name;
    if (!handleName) {
      return newComponentSpec;
    }

    targetHandleId = inputNameToNodeId(handleName);
  } else if (toHandleType === "output") {
    const handleName = componentRef.spec?.outputs?.find(
      (io) => io.type === connectionType,
    )?.name;
    if (!handleName) {
      return newComponentSpec;
    }

    targetHandleId = outputNameToNodeId(handleName);
  }

  // 4. Build a Connection object and use handleConnection to add the edge
  if (fromNodeId && fromHandleId && targetHandleId) {
    const isReversedConnection =
      fromHandleType === "input" && toHandleType === "output";
    const connection: Connection = isReversedConnection
      ? // Drawing from an input handle to a new output handle
        {
          source: newNodeId,
          sourceHandle: targetHandleId,
          target: fromNodeId,
          targetHandle: fromHandleId,
        }
      : // Drawing from an output handle to a new input handle
        {
          source: fromNodeId,
          sourceHandle: fromHandleId,
          target: newNodeId,
          targetHandle: targetHandleId,
        };

    const updatedGraphSpec = handleConnection(graphSpec, connection);

    return {
      ...newComponentSpec,
      implementation: {
        ...newComponentSpec.implementation,
        graph: updatedGraphSpec,
      },
    };
  }

  return newComponentSpec;
}
