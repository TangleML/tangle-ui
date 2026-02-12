import {
  BaseEdge,
  type ConnectionLineComponent,
  type ConnectionLineComponentProps,
  getBezierPath,
  type Handle,
  type Node,
} from "@xyflow/react";

import { extractResource } from "../../utils/string";

export const ConnectionLine: ConnectionLineComponent = ({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  connectionStatus,
  fromHandle,
  toHandle,
  fromNode,
  toNode,
}: ConnectionLineComponentProps) => {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  let color;

  switch (connectionStatus) {
    case "valid":
      color = "green";
      break;
    case "invalid":
      color = "red";
      break;
    default:
      color = "gray";
  }

  if (
    toNode &&
    toHandle &&
    isInvalidConnection({ fromNode, toNode, fromHandle, toHandle })
  ) {
    color = "red";
  }

  const id = `connection-${fromX}-${fromY}-${toX}-${toY}`;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: color,
        strokeWidth: 2,
      }}
    />
  );
};

const isInvalidConnection = ({
  fromNode,
  toNode,
  fromHandle,
  toHandle,
}: {
  fromNode: Node;
  toNode: Node;
  fromHandle: Handle;
  toHandle: Handle;
}) => {
  const fromResource = extractResource(fromHandle.id);
  const toResource = extractResource(toHandle?.id);

  if (!fromResource) {
    return true;
  }

  if (fromResource === "any" || toResource === "any") {
    return false;
  }

  if (fromResource !== toResource) {
    return true;
  }

  if (fromNode.id === toNode?.id) {
    return true;
  }

  return false;
};
