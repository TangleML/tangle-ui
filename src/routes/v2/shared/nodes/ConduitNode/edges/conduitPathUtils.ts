import type { XYPosition } from "@xyflow/react";
import { Position } from "@xyflow/react";

import type { GuidelineInfo } from "@/routes/v2/shared/nodes/types";

import {
  buildOrthogonalPolyline,
  removeCollinearPoints,
} from "./orthogonalPolyline";
import { roundPathCorners } from "./roundPathCorners";

const EDGE_SPACING = 4;

interface ConduitEdgePathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  guidelines: GuidelineInfo[];
  options?: {
    isSelected?: boolean;
  };
}

interface DebugPoint {
  point: XYPosition;
  type: "waypoint" | "path";
  conduitIndex: number;
}

interface ConduitPathResult {
  path: string;
  debugPoints: DebugPoint[];
}

/**
 * Compute the perpendicular offset for an edge on a guideline based on
 * its index among all edges attached to that guideline.
 */
function guidelineEdgeOffset(edgeIndex: number, edgeTotal: number): number {
  if (edgeTotal <= 1) return 0;
  return (edgeIndex - (edgeTotal - 1) / 2) * EDGE_SPACING;
}

/**
 * Closest point on a guideline to a target.
 * - Horizontal guideline at y=Y: projects target onto Y, keeping target.x
 * - Vertical guideline at x=X: projects target onto X, keeping target.y
 *
 * Then applies perpendicular offset for bundled edges.
 */
function closestPointOnGuideline(
  guideline: GuidelineInfo,
  target: XYPosition,
): XYPosition {
  const offset = guidelineEdgeOffset(guideline.edgeIndex, guideline.edgeTotal);

  if (guideline.orientation === "horizontal") {
    return { x: target.x, y: guideline.coordinate + offset };
  }
  return { x: guideline.coordinate + offset, y: target.y };
}

function dist(a: XYPosition, b: XYPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function handleOffsetVector(position: Position, magnitude: number): XYPosition {
  switch (position) {
    case Position.Right:
      return { x: magnitude, y: 0 };
    case Position.Left:
      return { x: -magnitude, y: 0 };
    case Position.Bottom:
      return { x: 0, y: magnitude };
    case Position.Top:
      return { x: 0, y: -magnitude };
  }
}

export function buildConduitPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  guidelines,
  options: _options,
}: ConduitEdgePathParams): ConduitPathResult {
  if (guidelines.length === 0) {
    return {
      path: fallbackBezier(
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      ),
      debugPoints: [],
    };
  }

  const handleXOffset = 8;
  const sourceXY: XYPosition = { x: sourceX, y: sourceY };
  const sourceHandleXY: XYPosition = {
    x: sourceX + handleXOffset,
    y: sourceY,
  };
  const targetXY: XYPosition = { x: targetX - handleXOffset, y: targetY };
  const targetHandleXY: XYPosition = {
    x: targetX + handleXOffset,
    y: targetY,
  };

  const remaining = [...guidelines];
  const guidelinePoints: XYPosition[] = [];
  let currentPoint = sourceHandleXY;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestEntry = closestPointOnGuideline(remaining[0], currentPoint);
    let bestExit = closestPointOnGuideline(remaining[0], targetXY);
    let bestCost = dist(currentPoint, bestEntry) + dist(bestEntry, bestExit);

    for (let i = 1; i < remaining.length; i++) {
      const entry = closestPointOnGuideline(remaining[i], currentPoint);
      const exit = closestPointOnGuideline(remaining[i], targetXY);
      const cost = dist(currentPoint, entry) + dist(entry, exit);
      if (cost < bestCost) {
        bestIdx = i;
        bestEntry = entry;
        bestExit = exit;
        bestCost = cost;
      }
    }

    guidelinePoints.push(bestEntry, bestExit);
    currentPoint = bestExit;
    remaining.splice(bestIdx, 1);
  }

  const pathPoints: XYPosition[] = [
    sourceXY,
    sourceHandleXY,
    ...guidelinePoints,
    targetXY,
    targetHandleXY,
  ];

  const path = removeCollinearPoints(buildOrthogonalPolyline(pathPoints));

  const debugPoints: DebugPoint[] = [
    ...pathPoints.map((point, i) => ({
      point,
      type: "waypoint" as const,
      conduitIndex: i,
    })),
    ...path.map((point, index) => ({
      point,
      type: "path" as const,
      conduitIndex: index,
    })),
  ];

  const pathString = roundPathCorners(
    linePath({ ...pathPoints[0], startPath: true }, ...path.slice(1)),
    4,
    false,
  );

  return { path: pathString, debugPoints };
}

function linePath(
  ...points: Array<XYPosition & { startPath?: boolean }>
): string {
  return points
    .map((point) => ` ${point.startPath ? "M" : "L"}${point.x},${point.y}`)
    .join("");
}

function fallbackBezier(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
): string {
  const dist = Math.hypot(targetX - sourceX, targetY - sourceY);
  const offset = Math.max(dist * 0.25, 30);

  const h1 = handleOffsetVector(sourcePosition, offset);
  const h2 = handleOffsetVector(targetPosition, offset);

  return `M${sourceX},${sourceY} C${sourceX + h1.x},${sourceY + h1.y} ${targetX + h2.x},${targetY + h2.y} ${targetX},${targetY}`;
}
