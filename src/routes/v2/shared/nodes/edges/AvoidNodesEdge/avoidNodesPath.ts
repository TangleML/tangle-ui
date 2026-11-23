import type { XYPosition } from "@xyflow/react";
import { Position } from "@xyflow/react";

import {
  buildOrthogonalPolyline,
  removeCollinearPoints,
} from "@/routes/v2/shared/nodes/ConduitNode/edges/orthogonalPolyline";
import { roundPathCorners } from "@/routes/v2/shared/nodes/ConduitNode/edges/roundPathCorners";

/** Axis-aligned rectangle in absolute flow coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AvoidNodesPathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  /** Obstacle rectangles, already inflated by the desired padding. */
  obstacles: Rect[];
}

/** How far to push the route out of the source/target handles. */
const HANDLE_STUB = 12;

/** Bounds the greedy detour recursion so pathological layouts stay cheap. */
const MAX_DETOUR_DEPTH = 6;

/** Corner radius applied to the final SVG path. */
export const CORNER_RADIUS = 8;

function offsetPoint(
  point: XYPosition,
  position: Position,
  magnitude: number,
): XYPosition {
  switch (position) {
    case Position.Right:
      return { x: point.x + magnitude, y: point.y };
    case Position.Left:
      return { x: point.x - magnitude, y: point.y };
    case Position.Top:
      return { x: point.x, y: point.y - magnitude };
    case Position.Bottom:
      return { x: point.x, y: point.y + magnitude };
    default:
      return point;
  }
}

function dist(a: XYPosition, b: XYPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Whether an axis-aligned segment overlaps a rectangle's interior. Uses strict
 * inequalities so a segment that merely grazes an edge is not a collision.
 */
function segmentHitsRect(a: XYPosition, b: XYPosition, rect: Rect): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const rectMaxX = rect.x + rect.width;
  const rectMaxY = rect.y + rect.height;

  return minX < rectMaxX && maxX > rect.x && minY < rectMaxY && maxY > rect.y;
}

function pointInsideRect(point: XYPosition, rect: Rect): boolean {
  return (
    point.x > rect.x &&
    point.x < rect.x + rect.width &&
    point.y > rect.y &&
    point.y < rect.y + rect.height
  );
}

function rectCorners(rect: Rect): XYPosition[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function firstCollision(
  polyline: XYPosition[],
  obstacles: Rect[],
): Rect | null {
  for (let i = 0; i < polyline.length - 1; i++) {
    for (const obstacle of obstacles) {
      if (segmentHitsRect(polyline[i], polyline[i + 1], obstacle)) {
        return obstacle;
      }
    }
  }
  return null;
}

/**
 * Pick the corner of the blocking obstacle that detours the route with the
 * least added length while staying clear of the other obstacles.
 */
function chooseDetourCorner(
  start: XYPosition,
  end: XYPosition,
  obstacle: Rect,
  obstacles: Rect[],
): XYPosition | null {
  let best: XYPosition | null = null;
  let bestCost = Infinity;

  for (const corner of rectCorners(obstacle)) {
    const blocked = obstacles.some(
      (other) => other !== obstacle && pointInsideRect(corner, other),
    );
    if (blocked) continue;

    const cost = dist(start, corner) + dist(corner, end);
    if (cost < bestCost) {
      bestCost = cost;
      best = corner;
    }
  }

  return best;
}

/**
 * Greedy orthogonal router: try a direct L-shaped route, and when it crosses an
 * obstacle, detour via that obstacle's cheapest free corner and recurse on the
 * two resulting sub-routes.
 */
function routeSegment(
  start: XYPosition,
  end: XYPosition,
  obstacles: Rect[],
  depth: number,
): XYPosition[] {
  const base = buildOrthogonalPolyline([start, end]);
  const blocking = firstCollision(base, obstacles);
  if (!blocking || depth >= MAX_DETOUR_DEPTH) return base;

  const detour = chooseDetourCorner(start, end, blocking, obstacles);
  if (!detour || dist(detour, start) < 1 || dist(detour, end) < 1) return base;

  const first = routeSegment(start, detour, obstacles, depth + 1);
  const second = routeSegment(detour, end, obstacles, depth + 1);

  return [...first, ...second.slice(1)];
}

export function toLinePath(points: XYPosition[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
}

/**
 * Build an orthogonal SVG path from the source handle to the target handle that
 * routes around the provided obstacle rectangles.
 */
export function buildAvoidNodesPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  obstacles,
}: AvoidNodesPathParams): string {
  const source: XYPosition = { x: sourceX, y: sourceY };
  const target: XYPosition = { x: targetX, y: targetY };
  const sourceStub = offsetPoint(source, sourcePosition, HANDLE_STUB);
  const targetStub = offsetPoint(target, targetPosition, HANDLE_STUB);

  const routed = routeSegment(sourceStub, targetStub, obstacles, 0);
  const points = removeCollinearPoints([source, ...routed, target]);

  return roundPathCorners(toLinePath(points), CORNER_RADIUS, false);
}
