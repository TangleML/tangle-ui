import type { EdgeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import type { ConduitEdgeData } from "@/routes/v2/shared/nodes/types";

import { buildConduitPath } from "./conduitPathUtils";

const DEBUG_POINTS = false;

const SIMPLIFIED_STROKE_MULTIPLIER = 1.5;

interface EdgeStyleParams {
  baseStyle: CSSProperties | undefined;
  conduitColor: string | undefined;
  isInAssignmentMode: boolean;
  isAssigned: boolean;
  activeColor: string | undefined;
  selected: boolean | undefined;
  strokeMultiplier: number;
}

function computeEdgeStyle({
  baseStyle,
  conduitColor,
  isInAssignmentMode,
  isAssigned,
  activeColor,
  selected,
  strokeMultiplier,
}: EdgeStyleParams): CSSProperties {
  const baseWidth = 4 * strokeMultiplier;
  const emphasisWidth = 5 * strokeMultiplier;

  let edgeStyle: CSSProperties = conduitColor
    ? { ...baseStyle, stroke: conduitColor, strokeWidth: baseWidth }
    : { ...baseStyle, stroke: "#6b7280", strokeWidth: baseWidth };

  if (isInAssignmentMode) {
    if (isAssigned && activeColor) {
      edgeStyle = {
        ...edgeStyle,
        stroke: activeColor,
        strokeWidth: emphasisWidth,
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
      strokeWidth: emphasisWidth,
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
  style,
  selected,
}: EdgeProps) {
  const showContent = useIsDetailedView();
  const strokeMultiplier = showContent ? 1 : SIMPLIFIED_STROKE_MULTIPLIER;

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
    strokeMultiplier,
  });

  const edgeColor = (edgeStyle.stroke as string) ?? "#6b7280";
  const markerId = `conduit-taper-${edgeColor.replace("#", "")}`;

  return (
    <>
      <defs>
        <marker
          id={`${markerId}-end`}
          markerWidth="12"
          markerHeight="12"
          refX="8"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L12,6 L0,12 Z" fill={edgeColor} />
        </marker>
        <marker
          id={`${markerId}-start`}
          markerWidth="12"
          markerHeight="12"
          refX="4"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M2,2 Q10,6 2,10 Q4,6 2,2"
            fill={edgeColor}
            stroke={edgeColor}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <path
        d={path}
        className="react-flow__edge-path"
        markerEnd={`url(#${markerId}-end)`}
        markerStart={`url(#${markerId}-start)`}
        style={edgeStyle}
      />
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
