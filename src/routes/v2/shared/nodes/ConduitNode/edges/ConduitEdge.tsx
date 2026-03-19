import type { EdgeProps } from "@xyflow/react";
import { BaseEdge } from "@xyflow/react";

import type { ConduitEdgeData } from "@/routes/v2/shared/nodes/types";

import { buildConduitPath } from "./conduitPathUtils";

const DEBUG_POINTS = false;

export function ConduitEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const edgeData = data as ConduitEdgeData | undefined;
  const guidelines = edgeData?.guidelines ?? [];
  const conduitColor = edgeData?.conduitColor;
  const isInAssignmentMode = edgeData?.isInAssignmentMode ?? false;
  const isAssigned = edgeData?.isAssignedToActiveConduit ?? false;
  const activeColor = edgeData?.activeConduitColor;

  const { path, debugPoints } = buildConduitPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    guidelines,
    options: {
      isSelected: selected,
    },
  });

  let edgeStyle = conduitColor
    ? { ...style, stroke: conduitColor, strokeWidth: 2 }
    : { ...style, strokeWidth: 2 };

  if (isInAssignmentMode) {
    if (isAssigned && activeColor) {
      edgeStyle = {
        ...edgeStyle,
        stroke: activeColor,
        strokeWidth: 3,
        opacity: 1,
      };
    } else {
      edgeStyle = { ...edgeStyle, opacity: 0.25 };
    }
  }

  if (selected) {
    edgeStyle = {
      ...edgeStyle,
      stroke: "#5b2ef4",
      strokeWidth: 3,
      opacity: 1,
    };
  }

  const debugPointColorMap = {
    waypoint: "#22c55e",
    path: "#6b7280",
  };

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={edgeStyle} />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={isInAssignmentMode ? { cursor: "pointer" } : undefined}
      />
      {DEBUG_POINTS &&
        debugPoints.map((dp, idx) => (
          <circle
            key={idx}
            cx={dp.point.x}
            cy={dp.point.y}
            r={dp.type === "path" ? 2 : 4}
            fill={debugPointColorMap[dp.type]}
            stroke="white"
            strokeWidth={dp.type === "path" ? 0.5 : 1.5}
            pointerEvents="none"
          >
            <title>{`${dp.type} (conduit ${dp.conduitIndex}): ${dp.point.x.toFixed(1)}, ${dp.point.y.toFixed(1)}`}</title>
          </circle>
        ))}
    </>
  );
}
