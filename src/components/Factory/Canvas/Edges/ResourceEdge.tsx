import type { EdgeProps } from "@xyflow/react";
import { BaseEdge, getBezierPath, useEdges } from "@xyflow/react";

import { isResourceData } from "../../types/resources";

const ResourceEdge = ({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
  markerEnd,
}: EdgeProps) => {
  const edges = useEdges();
  const hasAnySelectedEdge = edges.some((edge) => edge.selected);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const baseColor = isResourceData(data) ? data.color : "#BCBCBC";

  const edgeColor = selected
    ? "var(--selected)"
    : hasAnySelectedEdge
      ? "#BCBCBC"
      : baseColor;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: edgeColor,
        strokeWidth: 3,
        ...style,
      }}
      interactionWidth={20}
    />
  );
};

export default ResourceEdge;
