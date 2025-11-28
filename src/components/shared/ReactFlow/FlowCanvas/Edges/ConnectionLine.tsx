import {
  type ConnectionLineComponent,
  type ConnectionLineComponentProps,
  getBezierPath,
  type Node,
  useConnection,
  useNodes,
} from "@xyflow/react";

import { EdgeColor } from "./utils";

export const ConnectionLine: ConnectionLineComponent = ({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  connectionStatus,
}: ConnectionLineComponentProps) => {
  const nodes = useNodes();
  const sourceNode = useConnection((connection) => connection.fromNode);
  const targetNode = useConnection((connection) => connection.toNode);

  const hasGhostNode = nodes.some((node) => node.type === "ghost");

  if (hasGhostNode) {
    return null;
  }

  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  let color =
    connectionStatus === "valid" ? EdgeColor.Valid : EdgeColor.Incomplete;

  if (sourceNode && targetNode && !isValidConnection(sourceNode, targetNode)) {
    color = EdgeColor.Invalid;
  }

  const markerId = `connection-line-arrow-${color}`;

  return (
    <g>
      <svg style={{ height: 0 }}>
        <defs>
          <marker
            id={markerId}
            markerWidth="12"
            markerHeight="12"
            refX="7"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M2,2 Q10,6 2,10 Q4,6 2,2"
              fill={color}
              stroke={color}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
      </svg>
      <path
        d={path}
        className="react-flow__edge-path"
        style={{
          stroke: color,
          strokeWidth: 4,
        }}
        markerEnd={`url(#${markerId})`}
      />
    </g>
  );
};

const isValidConnection = (fromNode: Node, toNode: Node) => {
  if (fromNode.id === toNode.id) {
    return false;
  }

  // IO nodes can't connect to each other
  const isFromIO = fromNode.type === "input" || fromNode.type === "output";
  const isToIO = toNode.type === "input" || toNode.type === "output";

  if (isFromIO && isToIO) {
    return false;
  }

  return true;
};
