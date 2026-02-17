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

  const { getLatestEdgeStats } = useStatistics();

  const edgeResource = isResourceData(data) ? data.type : undefined;
  const edgeTransfers =
    edgeResource === "any"
      ? getLatestEdgeStats(id, true) // todo: saved stats appear to be incorrect after merging and splitting again (especially if it's a sushi belt) - note the correct amounts are transferred downstream to the building. it's just the value saved int he stats & shown onscreen that is wrong.
      : getLatestEdgeStats(id);

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
          edgeId={id}
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
    id,
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
      {edgeTransfers && edgeTransfers.length > 0 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) rotate(${labelRotation}deg) translateY(-8px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <TransportationFeedback transfers={edgeTransfers} />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default ResourceEdge;
