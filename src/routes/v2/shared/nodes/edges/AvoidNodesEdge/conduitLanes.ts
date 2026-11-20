import type { Edge, Node, XYPosition } from "@xyflow/react";

import type { HandleBoundsMap } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";

/** Node types that never participate in lane routing. */
const SKIP_TYPES = new Set(["ghost", "conduit"]);

/** Perpendicular distance between adjacent tracks inside a gutter (flow units). */
export const TRACK_SPACING = 18;

/** Clearance kept between a gutter's outermost track and the flanking nodes. */
export const GUTTER_MARGIN = 20;

/** Distance a synthetic (out-of-bounds) horizontal gutter sits from the nodes. */
const BOUNDARY_GUTTER_OFFSET = 40;

interface Rect {
  left: number;
  right: number;
  top: number;
  height: number;
}

/** Column/row index a node occupies, derived from its snapped position. */
export interface GridCell {
  col: number;
  row: number;
}

/**
 * Track demand per gutter, in grid-index space. Keyed by the index of the
 * column/row immediately before the gutter (gutter `k` sits between column/row
 * `k` and `k + 1`). Consumed by the grid layout to widen gaps so every track
 * fits without overlap.
 */
export interface GutterDemand {
  vertical: Map<number, number>;
  horizontal: Map<number, number>;
}

function isRoutable(node: Node): boolean {
  if (node.type && SKIP_TYPES.has(node.type)) return false;
  return node.measured?.width != null && node.measured?.height != null;
}

function buildRects(nodes: Node[]): Map<string, Rect> {
  const map = new Map<string, Rect>();
  for (const node of nodes) {
    if (!isRoutable(node)) continue;
    const width = node.measured?.width ?? 0;
    const height = node.measured?.height ?? 0;
    map.set(node.id, {
      left: node.position.x,
      right: node.position.x + width,
      top: node.position.y,
      height,
    });
  }
  return map;
}

/** Absolute Y of a handle, falling back to the node's vertical center. */
function handleY(
  rect: Rect,
  bounds: HandleBoundsMap | undefined,
  nodeId: string,
  handleId: string | null | undefined,
  role: "source" | "target",
): number {
  const offset =
    handleId != null ? bounds?.get(nodeId)?.[role].get(handleId) : undefined;
  return rect.top + (offset ?? rect.height / 2);
}

/** Map a sorted list of unique coordinates to their index. */
function indexByCoordinate(values: number[]): Map<number, number> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  sorted.forEach((value, index) => map.set(value, index));
  return map;
}

interface Grid {
  cellByNode: Map<string, GridCell>;
  /** Right boundary (widest node) of each column. */
  colRight: number[];
  /** Left boundary of each column. */
  colLeft: number[];
  /** Bottom boundary (tallest node) of each row. */
  rowBottom: number[];
  /** Top boundary of each row. */
  rowTop: number[];
  maxRow: number;
}

function buildGrid(rects: Map<string, Rect>): Grid {
  const colIndex = indexByCoordinate([...rects.values()].map((r) => r.left));
  const rowIndex = indexByCoordinate([...rects.values()].map((r) => r.top));

  const colLeft: number[] = new Array(colIndex.size).fill(0);
  const colRight: number[] = new Array(colIndex.size).fill(-Infinity);
  const rowTop: number[] = new Array(rowIndex.size).fill(0);
  const rowBottom: number[] = new Array(rowIndex.size).fill(-Infinity);

  const cellByNode = new Map<string, GridCell>();
  for (const [id, rect] of rects) {
    const col = colIndex.get(rect.left) ?? 0;
    const row = rowIndex.get(rect.top) ?? 0;
    cellByNode.set(id, { col, row });
    colLeft[col] = rect.left;
    colRight[col] = Math.max(colRight[col], rect.right);
    rowTop[row] = rect.top;
    rowBottom[row] = Math.max(rowBottom[row], rect.top + rect.height);
  }

  return {
    cellByNode,
    colRight,
    colLeft,
    rowBottom,
    rowTop,
    maxRow: rowIndex.size - 1,
  };
}

/**
 * Pick the horizontal gutter a multi-column edge runs its bus through: the
 * gutter just outside the *target* row, so the long horizontal run sits next to
 * where the edge lands. Anchoring on the target (rather than the source) spreads
 * buses across every target row instead of stacking them all in the source
 * row's gutter — the edge instead descends as a distinct vertical track in the
 * source's exit gutter and peels off horizontally at its own row. This keeps
 * long parallel horizontals from piling into one dense, unreadable band.
 */
function chooseBusGutter(rs: number, rt: number, maxRow: number): number {
  if (rt > rs) return rt - 1;
  if (rt < rs) return rt;
  return rs < maxRow ? rs : rs - 1;
}

/** Left boundary (source column right edge) of vertical gutter `k`. */
function verticalGutterLeft(grid: Grid, k: number): number {
  return grid.colRight[k];
}

/** Right boundary (target column left edge) of vertical gutter `k`. */
function verticalGutterRight(grid: Grid, k: number): number {
  return grid.colLeft[k + 1];
}

/** Center of horizontal gutter `g` (between row `g` and `g + 1`). */
function horizontalGutterCenter(grid: Grid, g: number): number {
  if (g < 0) return grid.rowTop[0] - BOUNDARY_GUTTER_OFFSET;
  if (g >= grid.maxRow) {
    return grid.rowBottom[grid.maxRow] + BOUNDARY_GUTTER_OFFSET;
  }
  return (grid.rowBottom[g] + grid.rowTop[g + 1]) / 2;
}

/** Offset of track `index` of `total` about the gutter center. */
function trackOffset(index: number, total: number): number {
  return (index - (total - 1) / 2) * TRACK_SPACING;
}

interface PlannedEdge {
  edgeId: string;
  sourceRight: number;
  sourceY: number;
  targetLeft: number;
  targetY: number;
  cs: number;
  ct: number;
  busGutter: number | null;
}

interface VerticalSegment {
  edgeId: string;
  gutter: number;
  /** Which end of this edge's route the assigned x feeds. */
  role: "exit" | "entry" | "single";
  sortKey: number;
}

interface HorizontalSegment {
  edgeId: string;
  gutter: number;
  sortKey: number;
}

/** Collect the routable forward edges together with their segment demands. */
function planEdges(
  edges: Edge[],
  rects: Map<string, Rect>,
  grid: Grid,
  bounds: HandleBoundsMap | undefined,
): {
  planned: PlannedEdge[];
  verticals: VerticalSegment[];
  horizontals: HorizontalSegment[];
} {
  const planned: PlannedEdge[] = [];
  const verticals: VerticalSegment[] = [];
  const horizontals: HorizontalSegment[] = [];

  for (const edge of edges) {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) continue;

    const sourceCell = grid.cellByNode.get(edge.source);
    const targetCell = grid.cellByNode.get(edge.target);
    if (!sourceCell || !targetCell) continue;

    const { col: cs, row: rs } = sourceCell;
    const { col: ct, row: rt } = targetCell;
    if (cs >= ct) continue;

    const sourceY = handleY(
      source,
      bounds,
      edge.source,
      edge.sourceHandle,
      "source",
    );
    const targetY = handleY(
      target,
      bounds,
      edge.target,
      edge.targetHandle,
      "target",
    );

    if (ct === cs + 1) {
      verticals.push({
        edgeId: edge.id,
        gutter: cs,
        role: "single",
        sortKey: (sourceY + targetY) / 2,
      });
      planned.push({
        edgeId: edge.id,
        sourceRight: source.right,
        sourceY,
        targetLeft: target.left,
        targetY,
        cs,
        ct,
        busGutter: null,
      });
      continue;
    }

    const busGutter = chooseBusGutter(rs, rt, grid.maxRow);
    verticals.push({
      edgeId: edge.id,
      gutter: cs,
      role: "exit",
      sortKey: targetY,
    });
    verticals.push({
      edgeId: edge.id,
      gutter: ct - 1,
      role: "entry",
      sortKey: sourceY,
    });
    horizontals.push({
      edgeId: edge.id,
      gutter: busGutter,
      sortKey: sourceY,
    });
    planned.push({
      edgeId: edge.id,
      sourceRight: source.right,
      sourceY,
      targetLeft: target.left,
      targetY,
      cs,
      ct,
      busGutter,
    });
  }

  return { planned, verticals, horizontals };
}

type EdgeRoleKey = string;

function roleKey(edgeId: string, role: VerticalSegment["role"]): EdgeRoleKey {
  return `${edgeId}:${role}`;
}

function sortSegments(list: VerticalSegment[]): void {
  list.sort((a, b) => a.sortKey - b.sortKey || (a.edgeId < b.edgeId ? -1 : 1));
}

/**
 * Assign each vertical segment a distinct x-track inside its gutter. Source-side
 * runs (exit/single) hug the source column's right edge and target-side runs
 * (entry) hug the target column's left edge, so an edge turns off its port
 * almost immediately. This keeps the shared horizontal stub between edges
 * leaving the same port down to a single margin instead of spanning a widened
 * gutter, which is what makes fanned edges read as distinct lines.
 */
function assignVerticalTracks(
  segments: VerticalSegment[],
  grid: Grid,
): Map<EdgeRoleKey, number> {
  const byGutter = new Map<number, VerticalSegment[]>();
  for (const segment of segments) {
    const list = byGutter.get(segment.gutter);
    if (list) list.push(segment);
    else byGutter.set(segment.gutter, [segment]);
  }

  const result = new Map<EdgeRoleKey, number>();
  for (const [gutter, list] of byGutter) {
    const sourceHug = list.filter((s) => s.role !== "entry");
    const targetHug = list.filter((s) => s.role === "entry");
    sortSegments(sourceHug);
    sortSegments(targetHug);

    const left = verticalGutterLeft(grid, gutter);
    const right = verticalGutterRight(grid, gutter);

    sourceHug.forEach((segment, index) => {
      result.set(
        roleKey(segment.edgeId, segment.role),
        left + GUTTER_MARGIN + index * TRACK_SPACING,
      );
    });
    targetHug.forEach((segment, index) => {
      result.set(
        roleKey(segment.edgeId, segment.role),
        right - GUTTER_MARGIN - index * TRACK_SPACING,
      );
    });
  }
  return result;
}

/** Assign each horizontal bus a distinct y-track inside its gutter. */
function assignHorizontalTracks(
  segments: HorizontalSegment[],
  grid: Grid,
): Map<string, number> {
  const byGutter = new Map<number, HorizontalSegment[]>();
  for (const segment of segments) {
    const list = byGutter.get(segment.gutter);
    if (list) list.push(segment);
    else byGutter.set(segment.gutter, [segment]);
  }

  const result = new Map<string, number>();
  for (const [gutter, list] of byGutter) {
    list.sort(
      (a, b) => a.sortKey - b.sortKey || (a.edgeId < b.edgeId ? -1 : 1),
    );
    const center = horizontalGutterCenter(grid, gutter);
    list.forEach((segment, index) => {
      result.set(segment.edgeId, center + trackOffset(index, list.length));
    });
  }
  return result;
}

function buildRoutePoints(
  edge: PlannedEdge,
  verticalTracks: Map<EdgeRoleKey, number>,
  busTracks: Map<string, number>,
): XYPosition[] {
  const start: XYPosition = { x: edge.sourceRight, y: edge.sourceY };
  const end: XYPosition = { x: edge.targetLeft, y: edge.targetY };

  if (edge.busGutter === null) {
    const trackX =
      verticalTracks.get(roleKey(edge.edgeId, "single")) ?? edge.sourceRight;
    return [
      start,
      { x: trackX, y: edge.sourceY },
      { x: trackX, y: edge.targetY },
      end,
    ];
  }

  const exitX =
    verticalTracks.get(roleKey(edge.edgeId, "exit")) ?? edge.sourceRight;
  const entryX =
    verticalTracks.get(roleKey(edge.edgeId, "entry")) ?? edge.targetLeft;
  const busY = busTracks.get(edge.edgeId) ?? edge.sourceY;

  return [
    start,
    { x: exitX, y: edge.sourceY },
    { x: exitX, y: busY },
    { x: entryX, y: busY },
    { x: entryX, y: edge.targetY },
    end,
  ];
}

/**
 * Route every forward edge deterministically through the layout's column and
 * row gutters, giving each edge its own vertical track in every column gap and
 * its own horizontal track in the row gap it buses through. Because no two
 * edges ever share a track, routed edges never render collinear.
 *
 * Back-edges (target at or left of source) and edges touching unmeasured or
 * skipped nodes are omitted, letting the caller fall back to the greedy router.
 */
export function planConduitRoutes(
  nodes: Node[],
  edges: Edge[],
  handleBounds?: HandleBoundsMap,
): Map<string, XYPosition[]> {
  const rects = buildRects(nodes);
  const grid = buildGrid(rects);

  const { planned, verticals, horizontals } = planEdges(
    edges,
    rects,
    grid,
    handleBounds,
  );

  const verticalTracks = assignVerticalTracks(verticals, grid);
  const busTracks = assignHorizontalTracks(horizontals, grid);

  const routes = new Map<string, XYPosition[]>();
  for (const edge of planned) {
    routes.set(edge.edgeId, buildRoutePoints(edge, verticalTracks, busTracks));
  }
  return routes;
}

function increment(map: Map<number, number>, key: number): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Count how many tracks each gutter must hold, in grid-index space, applying
 * the same routing rules as {@link planConduitRoutes}. The grid layout uses
 * this to widen column and row gaps so every track fits without overlap.
 *
 * `cellByNode` maps a node id to its column (rank) and row indices.
 */
export function computeGutterDemand(
  cellByNode: Map<string, GridCell>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  maxRow: number,
): GutterDemand {
  const vertical = new Map<number, number>();
  const horizontal = new Map<number, number>();

  for (const edge of edges) {
    const source = cellByNode.get(edge.source);
    const target = cellByNode.get(edge.target);
    if (!source || !target) continue;
    if (source.col >= target.col) continue;

    if (target.col === source.col + 1) {
      increment(vertical, source.col);
      continue;
    }

    increment(vertical, source.col);
    increment(vertical, target.col - 1);

    const busGutter = chooseBusGutter(source.row, target.row, maxRow);
    if (busGutter >= 0 && busGutter < maxRow) increment(horizontal, busGutter);
  }

  return { vertical, horizontal };
}
