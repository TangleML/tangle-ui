import type { EdgeProps } from "@xyflow/react";

import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import {
  EdgeGraphic,
  parseEdgeData,
} from "@/routes/v2/shared/nodes/edges/edgePresentation";

import { buildConduitPath } from "./conduitPathUtils";

const DEBUG_POINTS = false;

const SIMPLIFIED_STROKE_MULTIPLIER = 1.5;

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

  const { guidelines } = parseEdgeData(data);

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

  return (
    <>
      <EdgeGraphic
        path={path}
        style={style}
        data={data}
        selected={selected}
        strokeMultiplier={strokeMultiplier}
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
