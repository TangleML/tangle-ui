import type { Node } from "@xyflow/react";
import { useConnection } from "@xyflow/react";
import { useMemo } from "react";

import type { GhostNodeData } from "@/components/shared/ReactFlow/FlowCanvas/GhostNode/types";
import {
  createGhostNode,
  getGhostNodeLabel,
} from "@/components/shared/ReactFlow/FlowCanvas/GhostNode/utils";
import type { ComponentSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import {
  nodeIdToInputName,
  nodeIdToOutputName,
  nodeIdToTaskId,
} from "@/utils/nodes/nodeIdUtils";

type UseGhostNodeParams = {
  readOnly?: boolean;
  metaKeyPressed: boolean;
  isConnecting: boolean;
  implementation: ComponentSpec["implementation"];
};

type UseGhostNodeReturn = {
  ghostNode: Node<GhostNodeData> | null;
  shouldCreateIONode: boolean;
};

type GhostNodeDataExtraction = {
  dataType: string;
  value?: string;
  defaultValue?: string;
  connectedTaskLabel?: string;
  connectedOutputName?: string;
};

/**
 * Converts TypeSpecType to a string representation for display.
 * Handles both string types and complex object types.
 */
const typeToString = (type: unknown): string => {
  if (typeof type === "string") {
    return type;
  }
  if (type && typeof type === "object") {
    return JSON.stringify(type);
  }
  return "Any";
};

/**
 * Extracts ghost node data for input connections.
 * Returns type information and default values for preview display.
 */
const extractInputGhostData = (
  componentRefSpec: ComponentSpec | undefined,
  handleName: string,
): GhostNodeDataExtraction => {
  const inputSpec = componentRefSpec?.inputs?.find(
    (input) => input.name === handleName,
  );
  return {
    dataType: typeToString(inputSpec?.type),
    defaultValue: undefined,
  };
};

/**
 * Extracts ghost node data for output connections.
 * Returns type information, connected task label, and output name for preview display.
 */
const extractOutputGhostData = (
  componentRefSpec: ComponentSpec | undefined,
  handleName: string,
  taskId: string,
): GhostNodeDataExtraction => {
  const outputSpec = componentRefSpec?.outputs?.find(
    (output) => output.name === handleName,
  );
  return {
    dataType: typeToString(outputSpec?.type),
    value: handleName,
    connectedOutputName: outputSpec?.name ?? handleName,
    connectedTaskLabel: componentRefSpec?.name ?? taskId,
  };
};

export const useGhostNode = ({
  readOnly,
  metaKeyPressed,
  isConnecting,
  implementation,
}: UseGhostNodeParams): UseGhostNodeReturn => {
  const connectionPosition = useConnection((connection) => connection.to);
  const connectionFromHandle = useConnection(
    (connection) => connection.fromHandle,
  );
  const connectionToHandle = useConnection((connection) => connection.toHandle);
  const connectionIsValid = useConnection((connection) => connection.isValid);

  const isConnectionTemporarilyValid =
    connectionIsValid === true && !!connectionToHandle;

  const ghostNode = useMemo<Node<GhostNodeData> | null>(() => {
    if (
      readOnly ||
      !metaKeyPressed ||
      !isConnecting ||
      !connectionPosition ||
      !connectionFromHandle ||
      !connectionFromHandle.nodeId?.startsWith("task_") ||
      !connectionFromHandle.type ||
      !isGraphImplementation(implementation) ||
      isConnectionTemporarilyValid
    ) {
      return null;
    }

    const taskId = nodeIdToTaskId(connectionFromHandle.nodeId);
    const taskSpec = implementation.graph.tasks[taskId];
    const componentRefSpec = taskSpec?.componentRef?.spec;

    const isInputConnection = connectionFromHandle.type === "target";
    const ioType: GhostNodeData["ioType"] = isInputConnection
      ? "input"
      : "output";

    const handleName = isInputConnection
      ? nodeIdToInputName(connectionFromHandle.id ?? "")
      : nodeIdToOutputName(connectionFromHandle.id ?? "");

    const extractedData = isInputConnection
      ? extractInputGhostData(componentRefSpec, handleName)
      : extractOutputGhostData(componentRefSpec, handleName, taskId);

    return createGhostNode({
      position: connectionPosition,
      ioType,
      label: getGhostNodeLabel(handleName, ioType),
      ...extractedData,
    });
  }, [
    readOnly,
    metaKeyPressed,
    isConnecting,
    connectionPosition,
    connectionFromHandle,
    implementation,
    isConnectionTemporarilyValid,
  ]);

  return {
    ghostNode,
    shouldCreateIONode: !!ghostNode,
  };
};
