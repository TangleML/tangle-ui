import dagre from "@dagrejs/dagre";
import type { Edge, InternalNode, Node, XYPosition } from "@xyflow/react";

import {
  computeGutterDemand,
  type GridCell,
  GUTTER_MARGIN,
  TRACK_SPACING,
} from "@/routes/v2/shared/nodes/edges/AvoidNodesEdge/conduitLanes";
import { DEFAULT_NODE_DIMENSIONS } from "@/utils/constants";

export type LayoutAlgorithm =
  "sugiyama" | "sugiyama_centered" | "digco" | "dwyer" | "pipeline_grid";

/**
 * Per-handle vertical offsets (relative to node top) for a single node,
 * keyed by handle id. Sourced from ReactFlow's internal `handleBounds`.
 */
interface NodeHandleOffsets {
  source: Map<string, number>;
  target: Map<string, number>;
}

/** Node id -> per-handle vertical offsets. */
export type HandleBoundsMap = Map<string, NodeHandleOffsets>;

/**
 * Extract per-handle vertical offsets from ReactFlow's internal node state.
 * Only used by the `pipeline_grid` algorithm; other algorithms ignore it.
 */
export function buildHandleBoundsMap(
  nodeIds: string[],
  getInternalNode: (id: string) => InternalNode | undefined,
): HandleBoundsMap {
  const map: HandleBoundsMap = new Map();

  for (const id of nodeIds) {
    const handleBounds = getInternalNode(id)?.internals.handleBounds;
    if (!handleBounds) continue;

    const source = new Map<string, number>();
    const target = new Map<string, number>();

    for (const handle of handleBounds.source ?? []) {
      if (handle.id) source.set(handle.id, handle.y);
    }
    for (const handle of handleBounds.target ?? []) {
      if (handle.id) target.set(handle.id, handle.y);
    }

    map.set(id, { source, target });
  }

  return map;
}

export const autoLayoutNodes = (
  nodes: Node[],
  edges: Edge[],
  algorithm: LayoutAlgorithm = "sugiyama",
  handleBounds?: HandleBoundsMap,
): Node[] => {
  if (algorithm === "pipeline_grid") {
    return layoutPipelineGrid(nodes, edges, handleBounds);
  }

  const dagreGraph = new dagre.graphlib.Graph();

  let config;
  switch (algorithm) {
    case "sugiyama_centered":
      config = {
        rankdir: "LR",
        ranker: "network-simplex",
        nodesep: 30,
        edgesep: 10,
        ranksep: 20,
      };
      break;
    case "digco":
      config = {
        rankdir: "LR",
        ranker: "tight-tree",
        nodesep: 30,
        edgesep: 10,
        ranksep: 80,
      };
      break;
    case "dwyer":
      config = {
        rankdir: "LR",
        ranker: "longest-path",
        nodesep: 60,
        edgesep: 15,
        ranksep: 100,
      };
      break;
    case "sugiyama":
    default:
      config = {
        rankdir: "LR",
        ranker: "network-simplex",
        nodesep: 40,
        edgesep: 20,
        ranksep: 80,
      };
  }

  dagreGraph.setGraph(config);
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.measured?.width,
      height: node.measured?.height,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Apply custom centering for sugiyama_centered
  let centeredPositions: Map<string, XYPosition> | null = null;
  if (algorithm === "sugiyama_centered") {
    centeredPositions = centerNodesInBuckets(nodes, dagreGraph, config);
  }

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    let position;
    if (centeredPositions && centeredPositions.has(node.id)) {
      const centered = centeredPositions.get(node.id)!;
      position = {
        x: centered.x - (node?.measured?.width || 0) / 2,
        y: centered.y - (node?.measured?.height || 0) / 2,
      };
    } else {
      position = {
        x: nodeWithPosition.x - (node?.measured?.width || 0) / 2,
        y: nodeWithPosition.y - (node?.measured?.height || 0) / 2,
      };
    }

    return {
      ...node,
      position,
    };
  });
};

/**
 * Center nodes vertically within horizontal buckets.
 * After Sugiyama layout, nodes may be spread vertically. This function:
 * 1. Buckets nodes by x position (rank)
 * 2. Within each bucket, sorts nodes by distance from global average y
 * 3. Places nodes as close as possible to center without overlapping
 */
function centerNodesInBuckets(
  nodes: Node[],
  dagreGraph: InstanceType<typeof dagre.graphlib.Graph>,
  config: {
    nodesep: number;
    rankdir?: string;
    ranker?: string;
    edgesep?: number;
    ranksep?: number;
  },
): Map<string, XYPosition> {
  const positions = new Map<
    string,
    XYPosition & { width: number; height: number }
  >();

  // Initialize buckets
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id) as {
      x: number;
      y: number;
    };
    positions.set(node.id, {
      x: nodeWithPosition.x,
      y: nodeWithPosition.y,
      width: node.measured?.width || DEFAULT_NODE_DIMENSIONS.w || 300,
      height: node.measured?.height || DEFAULT_NODE_DIMENSIONS.h || 300,
    });
  });

  if (nodes.length === 0) return new Map();

  const allY = Array.from(positions.values()).map((p) => p.y);
  const avgY = allY.reduce((sum, y) => sum + y, 0) / allY.length;

  const buckets = new Map<number, string[]>();

  for (const [nodeId, pos] of positions.entries()) {
    const bucketIdx = Math.round(pos.x);
    if (!buckets.has(bucketIdx)) {
      buckets.set(bucketIdx, []);
    }
    buckets.get(bucketIdx)!.push(nodeId);
  }

  const centeredPositions = new Map<string, XYPosition>();

  // Process each bucket
  for (const [_, nodeIds] of buckets.entries()) {
    if (nodeIds.length === 1) {
      const pos = positions.get(nodeIds[0])!;
      centeredPositions.set(nodeIds[0], {
        x: pos.x,
        y: avgY,
      });
      continue;
    }

    const bucketAvgY =
      nodeIds.reduce((sum, id) => sum + positions.get(id)!.y, 0) /
      nodeIds.length;

    nodeIds.sort((a, b) => {
      const distA = Math.abs(positions.get(a)!.y - bucketAvgY);
      const distB = Math.abs(positions.get(b)!.y - bucketAvgY);
      return distA - distB;
    });

    let occupiedMin: number | null = null;
    let occupiedMax: number | null = null;

    for (const nodeId of nodeIds) {
      const pos = positions.get(nodeId)!;
      const originalY = pos.y;
      const height = pos.height;

      let centeredY: number;

      if (occupiedMin === null) {
        centeredY = avgY;
        occupiedMin = avgY - height / 2 - config.nodesep;
        occupiedMax = avgY + height / 2 + config.nodesep;
      } else if (originalY < bucketAvgY) {
        centeredY = occupiedMin - height / 2;
        occupiedMin = centeredY - height / 2 - config.nodesep;
      } else {
        centeredY = (occupiedMax || 0) + height / 2;
        occupiedMax = centeredY + height / 2 + config.nodesep;
      }

      centeredPositions.set(nodeId, {
        x: pos.x,
        y: centeredY,
      });
    }
  }

  return centeredPositions;
}

// ---------------------------------------------------------------------------
// Pipeline grid layout
//
// A port-aware, left-to-right layout tailored to pipelines. Nodes are placed
// on a virtual grid: inputs on the left, outputs on the right. Sources feeding
// a node are ordered to match that node's input-port order, and connected
// output/input handles are aligned vertically where spacing allows.
// ---------------------------------------------------------------------------

const COLUMN_GAP = 120;
const VERTICAL_GAP = 60;
/**
 * Must match the canvas snap grid (`GRID_SIZE` in
 * `src/routes/v2/shared/flowCanvasDefaults.ts`). Port handle offsets are
 * multiples of this value, so snapping laid-out node positions to the same grid
 * preserves connected-handle alignment (straight conduits). A mismatched grid
 * shifts each node independently and reintroduces a non-grid misalignment that
 * users cannot drag away.
 */
const GRID_SIZE = 10;
const ORDERING_SWEEPS = 4;
const FALLBACK_NODE_HEIGHT = 100;

interface GridEdge {
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

interface GridNode {
  id: string;
  width: number;
  height: number;
  rank: number;
  order: number;
  bary: number;
  row: number;
  x: number;
  y: number;
}

function layoutPipelineGrid(
  nodes: Node[],
  edges: Edge[],
  handleBounds?: HandleBoundsMap,
): Node[] {
  if (nodes.length === 0) return nodes;

  const nodeMap = buildGridNodes(nodes);
  const gridEdges = normalizeEdges(edges, nodeMap);
  const incoming = groupEdges(gridEdges, (e) => e.target);
  const outgoing = groupEdges(gridEdges, (e) => e.source);

  assignRanks(nodeMap, incoming);
  const layers = buildLayers(nodeMap, nodes);
  const maxRank = getMaxRank(nodeMap);

  orderLayers(layers, maxRank, incoming, outgoing, nodeMap, handleBounds);
  assignRowIndices(layers, maxRank, incoming, outgoing, nodeMap);

  // Reserve gutter space for edge lanes so the deterministic conduit router can
  // give every edge its own non-overlapping track (see conduitLanes.ts).
  const demand = computeGutterDemand(
    buildCellMap(nodeMap),
    gridEdges,
    getMaxRow(nodeMap),
  );

  positionColumns(nodeMap, layers, demand.vertical);
  computeRowPositions(nodeMap, demand.horizontal);

  return nodes.map((node) => {
    const grid = nodeMap.get(node.id);
    if (!grid) return node;
    return {
      ...node,
      position: { x: snapToGrid(grid.x), y: snapToGrid(grid.y) },
    };
  });
}

function buildGridNodes(nodes: Node[]): Map<string, GridNode> {
  const map = new Map<string, GridNode>();
  nodes.forEach((node, index) => {
    map.set(node.id, {
      id: node.id,
      width: node.measured?.width ?? DEFAULT_NODE_DIMENSIONS.w ?? 300,
      height: node.measured?.height ?? FALLBACK_NODE_HEIGHT,
      rank: 0,
      order: index,
      bary: 0,
      row: 0,
      x: 0,
      y: 0,
    });
  });
  return map;
}

/** Keep only edges whose endpoints exist in the node set. */
function normalizeEdges(
  edges: Edge[],
  nodeMap: Map<string, GridNode>,
): GridEdge[] {
  return edges
    .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    }));
}

function groupEdges(
  edges: GridEdge[],
  keyFn: (edge: GridEdge) => string,
): Map<string, GridEdge[]> {
  const map = new Map<string, GridEdge[]>();
  for (const edge of edges) {
    const key = keyFn(edge);
    const list = map.get(key);
    if (list) {
      list.push(edge);
      continue;
    }
    map.set(key, [edge]);
  }
  return map;
}

/**
 * Longest-path ranking (column index). Roots (no incoming edges) get rank 0;
 * every other node sits one column right of its deepest predecessor. Memoized
 * with a cycle guard so a stray cycle cannot cause infinite recursion.
 */
function assignRanks(
  nodeMap: Map<string, GridNode>,
  incoming: Map<string, GridEdge[]>,
): void {
  const inStack = new Set<string>();
  const resolved = new Set<string>();

  const visit = (id: string): number => {
    const node = nodeMap.get(id);
    if (!node) return 0;
    if (resolved.has(id)) return node.rank;

    const preds = incoming.get(id) ?? [];
    if (preds.length === 0) {
      node.rank = 0;
      resolved.add(id);
      return 0;
    }

    inStack.add(id);
    let maxPred = 0;
    for (const edge of preds) {
      if (inStack.has(edge.source)) continue;
      maxPred = Math.max(maxPred, visit(edge.source) + 1);
    }
    inStack.delete(id);

    node.rank = maxPred;
    resolved.add(id);
    return maxPred;
  };

  for (const id of nodeMap.keys()) {
    visit(id);
  }
}

/** Group nodes by rank, seeding vertical order from their current Y. */
function buildLayers(
  nodeMap: Map<string, GridNode>,
  nodes: Node[],
): Map<number, GridNode[]> {
  const seedY = new Map<string, number>();
  for (const node of nodes) {
    seedY.set(node.id, node.position?.y ?? 0);
  }

  const layers = new Map<number, GridNode[]>();
  for (const node of nodeMap.values()) {
    const list = layers.get(node.rank);
    if (list) {
      list.push(node);
      continue;
    }
    layers.set(node.rank, [node]);
  }

  for (const layer of layers.values()) {
    layer.sort((a, b) => (seedY.get(a.id) ?? 0) - (seedY.get(b.id) ?? 0));
    reindexLayer(layer);
  }

  return layers;
}

function getMaxRank(nodeMap: Map<string, GridNode>): number {
  let max = 0;
  for (const node of nodeMap.values()) {
    max = Math.max(max, node.rank);
  }
  return max;
}

/**
 * Assign each column a shared X based on the widest node in earlier columns.
 * The gap after column `rank` grows to fit the vertical edge tracks routed
 * through that gutter (`verticalDemand`), so lanes never overlap.
 */
function positionColumns(
  nodeMap: Map<string, GridNode>,
  layers: Map<number, GridNode[]>,
  verticalDemand: Map<number, number>,
): void {
  const widthByRank = new Map<number, number>();
  for (const node of nodeMap.values()) {
    widthByRank.set(
      node.rank,
      Math.max(widthByRank.get(node.rank) ?? 0, node.width),
    );
  }

  const maxRank = getMaxRank(nodeMap);
  const xByRank = new Map<number, number>();
  let x = 0;
  for (let rank = 0; rank <= maxRank; rank++) {
    xByRank.set(rank, x);
    x +=
      (widthByRank.get(rank) ?? 0) +
      gapForTracks(verticalDemand, rank, COLUMN_GAP);
  }

  for (const layer of layers.values()) {
    for (const node of layer) {
      node.x = xByRank.get(node.rank) ?? 0;
    }
  }
}

/**
 * Gap wide enough to hold `demand[index]` parallel tracks plus clearance, never
 * smaller than `base`. Keeps aligned nodes readable while guaranteeing the
 * conduit router can fit every edge on its own track.
 */
function gapForTracks(
  demand: Map<number, number>,
  index: number,
  base: number,
): number {
  const tracks = demand.get(index) ?? 0;
  return Math.max(base, tracks * TRACK_SPACING + 2 * GUTTER_MARGIN);
}

function getMaxRow(nodeMap: Map<string, GridNode>): number {
  let max = 0;
  for (const node of nodeMap.values()) max = Math.max(max, node.row);
  return max;
}

function buildCellMap(nodeMap: Map<string, GridNode>): Map<string, GridCell> {
  const map = new Map<string, GridCell>();
  for (const node of nodeMap.values()) {
    map.set(node.id, { col: node.rank, row: node.row });
  }
  return map;
}

function reindexLayer(layer: GridNode[]): void {
  layer.forEach((node, index) => {
    node.order = index;
  });
}

/**
 * Barycenter ordering with alternating down/up sweeps to reduce crossings.
 * A fractional port offset biases the ordering so sources feeding the same
 * node follow that node's input-port order (and vice versa for outputs).
 */
function orderLayers(
  layers: Map<number, GridNode[]>,
  maxRank: number,
  incoming: Map<string, GridEdge[]>,
  outgoing: Map<string, GridEdge[]>,
  nodeMap: Map<string, GridNode>,
  bounds: HandleBoundsMap | undefined,
): void {
  for (let sweep = 0; sweep < ORDERING_SWEEPS; sweep++) {
    const down = sweep % 2 === 0;
    const ranks = down
      ? rangeAscending(1, maxRank)
      : rangeDescending(maxRank - 1, 0);

    for (const rank of ranks) {
      const layer = layers.get(rank);
      if (!layer) continue;

      for (const node of layer) {
        node.bary = barycenter(node, incoming, outgoing, nodeMap, bounds, down);
      }
      layer.sort((a, b) => a.bary - b.bary);
      reindexLayer(layer);
    }
  }
}

function barycenter(
  node: GridNode,
  incoming: Map<string, GridEdge[]>,
  outgoing: Map<string, GridEdge[]>,
  nodeMap: Map<string, GridNode>,
  bounds: HandleBoundsMap | undefined,
  down: boolean,
): number {
  const edges = (down ? incoming : outgoing).get(node.id) ?? [];
  let sum = 0;
  let count = 0;

  for (const edge of edges) {
    const neighborId = down ? edge.source : edge.target;
    const neighbor = nodeMap.get(neighborId);
    if (!neighbor) continue;

    const fraction = down
      ? handleOffset(
          bounds,
          neighborId,
          edge.sourceHandle,
          "source",
          neighbor,
        ) / neighbor.height
      : handleOffset(
          bounds,
          neighborId,
          edge.targetHandle,
          "target",
          neighbor,
        ) / neighbor.height;

    sum += neighbor.order + fraction;
    count += 1;
  }

  return count === 0 ? node.order : sum / count;
}

/**
 * Assign each node an integer row index so nodes land on a shared grid of rows
 * that line up across columns.
 *
 * Rows are seeded from the crossing-minimised within-column order, then pulled
 * toward the median row of connected neighbours over alternating down/up
 * sweeps. Each sweep packs a column so its rows stay strictly increasing
 * (distinct), which — combined with per-row heights in `computeRowPositions` —
 * guarantees nodes never overlap.
 */
function assignRowIndices(
  layers: Map<number, GridNode[]>,
  maxRank: number,
  incoming: Map<string, GridEdge[]>,
  outgoing: Map<string, GridEdge[]>,
  nodeMap: Map<string, GridNode>,
): void {
  for (const layer of layers.values()) {
    const sorted = [...layer].sort((a, b) => a.order - b.order);
    sorted.forEach((node, index) => {
      node.row = index;
    });
  }

  for (let sweep = 0; sweep < ORDERING_SWEEPS; sweep++) {
    const down = sweep % 2 === 0;
    const ranks = down
      ? rangeAscending(1, maxRank)
      : rangeDescending(maxRank - 1, 0);

    for (const rank of ranks) {
      const layer = layers.get(rank);
      if (!layer) continue;
      alignRows(layer, (node) =>
        desiredRow(node, down ? incoming : outgoing, nodeMap, down),
      );
    }
  }

  normalizeRows(nodeMap);
}

/**
 * Place nodes at their desired (rounded) row, top-to-bottom in their existing
 * order, keeping rows strictly increasing so no two nodes in a column collide.
 */
function alignRows(
  layer: GridNode[],
  desiredRowFn: (node: GridNode) => number | null,
): void {
  const sorted = [...layer].sort((a, b) => a.order - b.order);
  let prevRow = Number.NEGATIVE_INFINITY;
  for (const node of sorted) {
    const desired = desiredRowFn(node);
    const target = desired == null ? node.row : Math.round(desired);
    node.row = Math.max(target, prevRow + 1);
    prevRow = node.row;
  }
}

/**
 * Median row of a node's connected neighbours (sources on a down sweep, targets
 * on an up sweep). Returns null when the node has no connections on that side,
 * leaving its seeded row untouched.
 */
function desiredRow(
  node: GridNode,
  edgesByNode: Map<string, GridEdge[]>,
  nodeMap: Map<string, GridNode>,
  down: boolean,
): number | null {
  const edges = edgesByNode.get(node.id) ?? [];
  const rows: number[] = [];

  for (const edge of edges) {
    const neighborId = down ? edge.source : edge.target;
    const neighbor = nodeMap.get(neighborId);
    if (!neighbor) continue;
    rows.push(neighbor.row);
  }

  return rows.length === 0 ? null : median(rows);
}

/** Shift all rows so the topmost node sits on row 0. */
function normalizeRows(nodeMap: Map<string, GridNode>): void {
  let min = Infinity;
  for (const node of nodeMap.values()) min = Math.min(min, node.row);
  if (!Number.isFinite(min) || min === 0) return;
  for (const node of nodeMap.values()) node.row -= min;
}

/**
 * Convert integer row indices into Y coordinates. Each row's height is the
 * tallest node assigned to it (across all columns), so rows stay compact while
 * sharing a single Y across columns — aligning nodes and their horizontal
 * routing channels onto a clean grid.
 */
function computeRowPositions(
  nodeMap: Map<string, GridNode>,
  horizontalDemand: Map<number, number>,
): void {
  const rowHeight = new Map<number, number>();
  let maxRow = 0;
  for (const node of nodeMap.values()) {
    rowHeight.set(
      node.row,
      Math.max(rowHeight.get(node.row) ?? 0, node.height),
    );
    maxRow = Math.max(maxRow, node.row);
  }

  const rowY = new Map<number, number>();
  let y = 0;
  for (let row = 0; row <= maxRow; row++) {
    rowY.set(row, y);
    y +=
      (rowHeight.get(row) ?? 0) +
      gapForTracks(horizontalDemand, row, VERTICAL_GAP);
  }

  for (const node of nodeMap.values()) {
    node.y = rowY.get(node.row) ?? 0;
  }
}

function handleOffset(
  bounds: HandleBoundsMap | undefined,
  nodeId: string,
  handleId: string | null,
  kind: "source" | "target",
  node: GridNode,
): number {
  const fallback = node.height / 2;
  if (!bounds || !handleId) return fallback;
  return bounds.get(nodeId)?.[kind].get(handleId) ?? fallback;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function rangeAscending(from: number, to: number): number[] {
  const result: number[] = [];
  for (let i = from; i <= to; i++) result.push(i);
  return result;
}

function rangeDescending(from: number, to: number): number[] {
  const result: number[] = [];
  for (let i = from; i >= to; i--) result.push(i);
  return result;
}

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}
