import type { EdgeProps } from "@xyflow/react";
import { BaseEdge, getBezierPath, useEdges } from "@xyflow/react";
import { useEffect } from "react";

import { useContextPanel } from "@/providers/ContextPanelProvider";

import ResourceContext from "../../Context/ResourceContext";
import { isResourceData } from "../../types/resources";

const ResourceEdge = ({
  id,
  data,
  source,
  sourceX,
  sourceY,
  target,
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
  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();

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

  useEffect(() => {
    if (selected && isResourceData(data)) {
      setContent(
        <ResourceContext
          resource={data}
          sourceNodeId={source}
          targetNodeId={target}
        />,
      );
      setContextPanelOpen(true);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [
    selected,
    data,
    source,
    target,
    setContent,
    clearContent,
    setContextPanelOpen,
  ]);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: edgeColor,
        strokeWidth: 3,
        filter: "drop-shadow(0 0 1px black)",
        ...style,
      }}
      interactionWidth={20}
    />
  );
};

export default ResourceEdge;
