import type { EdgeProps } from "@xyflow/react";
import { getBezierPath } from "@xyflow/react";

const SmoothEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
  data,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const state = selected
    ? "selected"
    : data?.highlighted
      ? "highlighted"
      : "default";

  const { edgeColor, markerIdSuffix } = getEdgeMetadata(state);

  return (
    <>
      <svg style={{ height: 0 }}>
        <defs>
          <marker
            id={`end-arrow-${markerIdSuffix}`}
            markerWidth="12"
            markerHeight="12"
            refX="7"
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
          <marker
            id={`start-arrow-${markerIdSuffix}`}
            markerWidth="10"
            markerHeight="10"
            refX="3"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill={edgeColor} />
          </marker>
        </defs>
      </svg>
      {/* Invisible hitbox path */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ cursor: "pointer" }}
        className="react-flow__edge-path-hitbox"
        id={`${id}-hitbox`}
        pointerEvents="stroke"
      />
      {/* Visible edge path */}
      <path
        id={id}
        d={edgePath}
        markerEnd={`url(#end-arrow-${markerIdSuffix})`}
        markerStart={`url(#start-arrow-${markerIdSuffix})`}
        className="react-flow__edge-path"
        style={{
          stroke: edgeColor,
          strokeWidth: 4,
          ...style,
        }}
      />
    </>
  );
};

export default SmoothEdge;

function getEdgeMetadata(state: "default" | "selected" | "highlighted") {
  switch (state) {
    case "selected":
      return {
        edgeColor: "#38bdf8",
        markerIdSuffix: "selected",
      };
    case "highlighted":
      return {
        edgeColor: "#ec4899",
        markerIdSuffix: "highlighted",
      };
    case "default":
    default:
      return {
        edgeColor: "#6b7280",
        markerIdSuffix: "default",
      };
  }
}
