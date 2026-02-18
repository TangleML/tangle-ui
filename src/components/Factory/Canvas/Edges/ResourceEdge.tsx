import type { EdgeProps } from "@xyflow/react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useEdges,
} from "@xyflow/react";
import { useEffect } from "react";

import { useContextPanel } from "@/providers/ContextPanelProvider";

import { TransportationFeedback } from "../../components/TransportationFeedback";
import ResourceContext from "../../Context/ResourceContext";
import { useStatistics } from "../../providers/StatisticsProvider";
import { isResourceData } from "../../types/resources";
import { getBezierMidpointAngle } from "../../utils/bezier";

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
  const { getLatestBuildingStats } = useStatistics();

  const sourceStats = getLatestBuildingStats(source);
  const resourcesTransferred = sourceStats?.stockpileChanges.filter(
    (c) => c.removed > 0,
  );

  const [edgePath, labelX, labelY] = getBezierPath({
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

  const labelRotation = getBezierMidpointAngle(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  );

  return (
    <>
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
      {resourcesTransferred && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(${labelX}px,${labelY}px) rotate(${labelRotation}deg)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <div className="absolute bottom-1">
              <TransportationFeedback
                resourcesTransferred={resourcesTransferred}
              />
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default ResourceEdge;
