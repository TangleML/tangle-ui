import type { EdgeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

import type { ConduitEdgeData } from "@/routes/v2/shared/nodes/types";

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
  const baseWidth = 2 * strokeMultiplier;
  const emphasisWidth = 5 * strokeMultiplier;

  let edgeStyle: CSSProperties = conduitColor
    ? { ...baseStyle, stroke: conduitColor, strokeWidth: baseWidth }
    : { ...baseStyle, stroke: "#3f4145", strokeWidth: baseWidth };

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

export function parseEdgeData(data: EdgeProps["data"]) {
  const edgeData = data as ConduitEdgeData | undefined;
  return {
    guidelines: edgeData?.guidelines ?? [],
    routePoints: edgeData?.routePoints,
    conduitColor: edgeData?.conduitColor,
    isInAssignmentMode: edgeData?.isInAssignmentMode ?? false,
    isAssigned: edgeData?.isAssignedToActiveConduit ?? false,
    activeColor: edgeData?.activeConduitColor,
  };
}

interface EdgeGraphicProps {
  path: string;
  style: CSSProperties | undefined;
  data: EdgeProps["data"];
  selected: boolean | undefined;
  strokeMultiplier: number;
}

/**
 * Shared visual presentation for orthogonal pipeline edges (conduit and
 * node-avoiding). Renders the taper markers, the visible stroke, and a wide
 * transparent interaction path. The routed SVG `path` is computed by callers.
 */
export function EdgeGraphic({
  path,
  style,
  data,
  selected,
  strokeMultiplier,
}: EdgeGraphicProps) {
  const { conduitColor, isInAssignmentMode, isAssigned, activeColor } =
    parseEdgeData(data);

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
  const markerId = `edge-taper-${edgeColor.replace("#", "")}`;

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
    </>
  );
}
