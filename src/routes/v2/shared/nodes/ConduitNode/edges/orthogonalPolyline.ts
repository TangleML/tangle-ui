// ───────────────────── Types ─────────────────────

import type { XYPosition } from "@xyflow/react";

/** 0 = Horizontal, 1 = Vertical */
type Dir = 0 | 1;
const H: Dir = 0;
const V: Dir = 1;
const DIRS: Dir[] = [H, V];

interface RoutingOption {
  entry: Dir;
  exit: Dir;
  internalTurns: number;
}

interface DpChoice {
  optionIdx: number;
  prevExitDir: Dir;
}

// ───────────────────── Core ─────────────────────

/**
 * Builds an orthogonal (rectilinear) polyline passing through all
 * given points in order, using the fewest possible turns.
 */
export function buildOrthogonalPolyline(points: XYPosition[]): XYPosition[] {
  if (points.length <= 1) return [...points];

  const options = buildSegmentOptions(points);
  const selected = optimizeChoices(options);

  return assemblePolyline(points, options, selected);
}

// ───────────────── Segment analysis ─────────────────

/** Returns the valid routing options for a single segment. */
function getRoutingOptions(from: XYPosition, to: XYPosition): RoutingOption[] {
  const sameX = from.x === to.x;
  const sameY = from.y === to.y;

  // Coincident points — direction is free, no turn cost
  if (sameX && sameY) {
    return [
      { entry: H, exit: H, internalTurns: 0 },
      { entry: V, exit: V, internalTurns: 0 },
    ];
  }

  // Axis-aligned — single direction, zero internal turns
  if (sameX) return [{ entry: V, exit: V, internalTurns: 0 }];
  if (sameY) return [{ entry: H, exit: H, internalTurns: 0 }];

  // Non-aligned — two L-shaped routings, each with one internal turn
  return [
    { entry: H, exit: V, internalTurns: 1 }, // horizontal first
    { entry: V, exit: H, internalTurns: 1 }, // vertical first
  ];
}

function buildSegmentOptions(points: XYPosition[]): RoutingOption[][] {
  const options: RoutingOption[][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    options.push(getRoutingOptions(points[i], points[i + 1]));
  }
  return options;
}

// ──────────────── DP optimization ────────────────

/**
 * Finds the combination of routing choices that minimizes total
 * turn count across all segments + junctions.
 *
 * State:  dp[dir] = minimum total turns arriving at current segment's
 *         end in direction `dir`.
 *
 * Transition: for each pair (prevExitDir, option) the junction cost
 *             is 1 if directions differ, 0 otherwise.
 */
function optimizeChoices(segmentOptions: RoutingOption[][]): number[] {
  const segCount = segmentOptions.length;
  if (segCount === 0) return [];

  // dp[dir] = best cost so far, exiting in `dir`
  let dp: [number, number] = [Infinity, Infinity];
  // backtracking table: history[segIdx][exitDir]
  const history: DpChoice[][] = [];

  // ── First segment (no junction cost) ──
  dp = initFirstSegment(segmentOptions[0], history);

  // ── Remaining segments ──
  for (let i = 1; i < segCount; i++) {
    dp = processSegment(dp, segmentOptions[i], history);
  }

  return backtrack(dp, history);
}

function initFirstSegment(
  options: RoutingOption[],
  history: DpChoice[][],
): [number, number] {
  const dp: [number, number] = [Infinity, Infinity];
  const row: DpChoice[] = [
    { optionIdx: 0, prevExitDir: H },
    { optionIdx: 0, prevExitDir: V },
  ];

  for (let oi = 0; oi < options.length; oi++) {
    const opt = options[oi];
    if (opt.internalTurns >= dp[opt.exit]) continue;

    dp[opt.exit] = opt.internalTurns;
    row[opt.exit] = { optionIdx: oi, prevExitDir: opt.entry };
  }

  history.push(row);
  return dp;
}

function processSegment(
  prevDp: [number, number],
  options: RoutingOption[],
  history: DpChoice[][],
): [number, number] {
  const dp: [number, number] = [Infinity, Infinity];
  const row: DpChoice[] = [
    { optionIdx: 0, prevExitDir: H },
    { optionIdx: 0, prevExitDir: V },
  ];

  for (let oi = 0; oi < options.length; oi++) {
    const opt = options[oi];

    for (const prevDir of DIRS) {
      if (prevDp[prevDir] === Infinity) continue;

      const junctionCost = prevDir !== opt.entry ? 1 : 0;
      const total = prevDp[prevDir] + junctionCost + opt.internalTurns;

      if (total >= dp[opt.exit]) continue;

      dp[opt.exit] = total;
      row[opt.exit] = { optionIdx: oi, prevExitDir: prevDir };
    }
  }

  history.push(row);
  return dp;
}

function backtrack(dp: [number, number], history: DpChoice[][]): number[] {
  const segCount = history.length;
  const result = new Array<number>(segCount);

  let curDir: Dir = dp[H] <= dp[V] ? H : V;

  for (let i = segCount - 1; i >= 0; i--) {
    const choice = history[i][curDir];
    result[i] = choice.optionIdx;
    curDir = choice.prevExitDir;
  }

  return result;
}

// ──────────────── Polyline assembly ────────────────

/** Computes the corner point for a non-aligned segment. */
function getCornerPoint(
  from: XYPosition,
  to: XYPosition,
  entryDir: Dir,
): XYPosition {
  // H-first: move horizontally to to.x, then vertically
  if (entryDir === H) return { x: to.x, y: from.y };
  // V-first: move vertically to to.y, then horizontally
  return { x: from.x, y: to.y };
}

function assemblePolyline(
  points: XYPosition[],
  segmentOptions: RoutingOption[][],
  selectedOptions: number[],
): XYPosition[] {
  const result: XYPosition[] = [points[0]];

  for (let i = 0; i < selectedOptions.length; i++) {
    const from = points[i];
    const to = points[i + 1];
    const option = segmentOptions[i][selectedOptions[i]];

    const needsCorner = from.x !== to.x && from.y !== to.y;
    if (needsCorner) {
      result.push(getCornerPoint(from, to, option.entry));
    }

    result.push(to);
  }

  return result;
}

// ──────────────── Optional cleanup ────────────────

/** Removes intermediate points that are collinear with their neighbors. */
export function removeCollinearPoints(polyline: XYPosition[]): XYPosition[] {
  if (polyline.length <= 2) return [...polyline];

  const result: XYPosition[] = [polyline[0]];

  for (let i = 1; i < polyline.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = polyline[i];
    const next = polyline[i + 1];

    const collinearH = prev.y === curr.y && curr.y === next.y;
    const collinearV = prev.x === curr.x && curr.x === next.x;

    if (collinearH || collinearV) continue;
    result.push(curr);
  }

  result.push(polyline[polyline.length - 1]);
  return result;
}
