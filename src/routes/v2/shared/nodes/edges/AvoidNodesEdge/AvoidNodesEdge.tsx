import type { EdgeProps, Node, XYPosition } from "@xyflow/react";
import { Position, useNodes } from "@xyflow/react";

import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { buildConduitPath } from "@/routes/v2/shared/nodes/ConduitNode/edges/conduitPathUtils";
import { removeCollinearPoints } from "@/routes/v2/shared/nodes/ConduitNode/edges/orthogonalPolyline";
import { roundPathCorners } from "@/routes/v2/shared/nodes/ConduitNode/edges/roundPathCorners";
import {
  EdgeGraphic,
  parseEdgeData,
} from "@/routes/v2/shared/nodes/edges/edgePresentation";

import {
  buildAvoidNodesPath,
  CORNER_RADIUS,
  type Rect,
  toLinePath,
} from "./avoidNodesPath";

const SIMPLIFIED_STROKE_MULTIPLIER = 1.5;

/** Padding added around each node so edges keep a small clearance. */
const OBSTACLE_PADDING = 12;

/** Node types that should not be treated as routing obstacles. */
const SKIP_OBSTACLE_TYPES = new Set(["ghost", "conduit"]);

function collectObstacles(
  nodes: Node[],
  sourceId: string,
  targetId: string,
): Rect[] {
  const rects: Rect[] = [];

  for (const node of nodes) {
    if (node.id === sourceId || node.id === targetId) continue;
    if (node.type && SKIP_OBSTACLE_TYPES.has(node.type)) continue;

    const width = node.measured?.width;
    const height = node.measured?.height;
    if (width == null || height == null) continue;

    rects.push({
      x: node.position.x - OBSTACLE_PADDING,
      y: node.position.y - OBSTACLE_PADDING,
      width: width + OBSTACLE_PADDING * 2,
      height: height + OBSTACLE_PADDING * 2,
    });
  }

  return rects;
}

/**
 * Render a precomputed lane route, replacing the planner's port estimates with
 * the live handle coordinates so the polyline connects exactly. Applies only to
 * the left-to-right handle orientation the lane router assumes; returns null
 * otherwise so the caller can fall back to the greedy router.
 */
function buildLaneRoutePath(
  routePoints: XYPosition[] | undefined,
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
): string | null {
  if (!routePoints || routePoints.length < 4) return null;
  if (sourcePosition !== Position.Right || targetPosition !== Position.Left) {
    return null;
  }

  const points = routePoints.map((point) => ({ ...point }));
  const last = points.length - 1;
  points[0] = { x: sourceX, y: sourceY };
  points[last] = { x: targetX, y: targetY };
  // Keep the first/last segments horizontal by aligning the adjacent bend to
  // the live handle Y (the planner's port Y may differ by a pixel).
  points[1] = { x: points[1].x, y: sourceY };
  points[last - 1] = { x: points[last - 1].x, y: targetY };

  return roundPathCorners(
    toLinePath(removeCollinearPoints(points)),
    CORNER_RADIUS,
    false,
  );
}

/**
 * Beta edge renderer that routes orthogonally around nodes. Conduit/guideline
 * edges keep their existing routing so remapping every `conduitEdge` to this
 * type is safe.
 */
export function AvoidNodesEdge({
  source,
  target,
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
  const nodes = useNodes();
  const { guidelines, routePoints } = parseEdgeData(data);

  let path: string;
  if (guidelines.length > 0) {
    // Manual (user-assigned) conduits keep their explicit routing.
    path = buildConduitPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      guidelines,
      options: { isSelected: selected },
    }).path;
  } else {
    const lanePath = buildLaneRoutePath(
      routePoints,
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    );
    path =
      lanePath ??
      buildAvoidNodesPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        obstacles: collectObstacles(nodes, source, target),
      });
  }

  return (
    <EdgeGraphic
      path={path}
      style={style}
      data={data}
      selected={selected}
      strokeMultiplier={strokeMultiplier}
    />
  );
}
