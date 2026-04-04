import type { EdgeProps } from "@xyflow/react";
import { BaseEdge } from "@xyflow/react";
import type { CSSProperties } from "react";

import type { ConduitEdgeData } from "@/routes/v2/shared/nodes/types";

import { buildConduitPath } from "./conduitPathUtils";

const DEBUG_POINTS = false;

interface EdgeStyleParams {
  baseStyle: CSSProperties | undefined;
  conduitColor: string | undefined;
  isInAssignmentMode: boolean;
  isAssigned: boolean;
  activeColor: string | undefined;
  selected: boolean | undefined;
}

function computeEdgeStyle({
  baseStyle,
  conduitColor,
  isInAssignmentMode,
  isAssigned,
  activeColor,
  selected,
}: EdgeStyleParams): CSSProperties {
  let edgeStyle: CSSProperties = conduitColor
    ? { ...baseStyle, stroke: conduitColor, strokeWidth: 2 }
    : { ...baseStyle, strokeWidth: 2 };

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

  return edgeStyle;
}

function parseEdgeData(data: EdgeProps["data"]) {
  const edgeData = data as ConduitEdgeData | undefined;
  return {
    guidelines: edgeData?.guidelines ?? [],
    conduitColor: edgeData?.conduitColor,
    isInAssignmentMode: edgeData?.isInAssignmentMode ?? false,
    isAssigned: edgeData?.isAssignedToActiveConduit ?? false,
    activeColor: edgeData?.activeConduitColor,
  };
}

const debugPointColorMap = {
  waypoint: "#22c55e",
  path: "#6b7280",
} as const;

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
  const {
    guidelines,
    conduitColor,
    isInAssignmentMode,
    isAssigned,
    activeColor,
  } = parseEdgeData(data);

  const { path, debugPoints } = buildConduitPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    guidelines,
    options: { isSelected: selected },
  });

  const edgeStyle = computeEdgeStyle({
    baseStyle: style,
    conduitColor,
    isInAssignmentMode,
    isAssigned,
    activeColor,
    selected,
  });

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
