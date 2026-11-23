import type { Edge, Node } from "@xyflow/react";

import type { HandleBoundsMap } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import type { GuidelineInfo } from "@/routes/v2/shared/nodes/types";

/** How far the virtual channels sit from a node's left/right edge. */
const VIRTUAL_CONDUIT_OFFSET = 24;

/** Node types that do not participate in virtual conduits. */
const SKIP_TYPES = new Set(["ghost", "conduit"]);

interface NodeRectFull {
  left: number;
  right: number;
  top: number;
  height: number;
}

interface EdgeCandidate {
  edgeId: string;
  xOut: number;
  xIn: number;
}

/** An edge sharing a vertical channel, tagged with its port Y for lane ordering. */
interface BucketEntry {
  edgeId: string;
  y: number;
}

/**
 * Absolute Y of an edge endpoint's handle. Uses the exact handle offset from
 * ReactFlow's internal bounds when available, falling back to the node's
 * vertical center when a handle is unmeasured or bounds are unavailable.
 */
function handleY(
  rect: NodeRectFull,
  handleBounds: HandleBoundsMap | undefined,
  nodeId: string,
  handleId: string | null | undefined,
  role: "source" | "target",
): number {
  const offset =
    handleId != null
      ? handleBounds?.get(nodeId)?.[role].get(handleId)
      : undefined;
  return rect.top + (offset ?? rect.height / 2);
}

function pushBucket(
  map: Map<number, BucketEntry[]>,
  key: number,
  entry: BucketEntry,
): void {
  const list = map.get(key);
  if (list) {
    list.push(entry);
    return;
  }
  map.set(key, [entry]);
}

function verticalGuideline(
  buckets: Map<number, BucketEntry[]>,
  coordinate: number,
  edgeId: string,
  offsetDirection: -1 | 1,
): GuidelineInfo {
  const bucket = buckets.get(coordinate) ?? [{ edgeId, y: 0 }];
  const edgeIndex = bucket.findIndex((entry) => entry.edgeId === edgeId);
  return {
    orientation: "vertical",
    coordinate,
    edgeIndex: Math.max(0, edgeIndex),
    edgeTotal: bucket.length,
    offsetDirection,
  };
}

/**
 * Derive virtual conduits from live node geometry. Each forward edge routes
 * through a vertical channel just right of its source (output) and just left of
 * its target (input). Aligned nodes share these coordinates, so their edges
 * bundle and fan out via the existing conduit offset logic — reducing visual
 * noise while keeping each edge a clean two-bend dogleg.
 *
 * Only vertical channels are emitted: a horizontal channel would fight the
 * greedy router in `buildConduitPath` and force edges back to the source row,
 * producing clunky rectangular detours.
 *
 * Back-edges (target left of source) and edges touching unmeasured/skipped
 * nodes return no guidelines, letting the caller fall back to the greedy
 * node-avoiding router.
 */
export function deriveVirtualConduitGuidelines(
  nodes: Node[],
  edges: Edge[],
  handleBounds?: HandleBoundsMap,
): Map<string, GuidelineInfo[]> {
  const rects = buildRectMapFull(nodes);

  const candidates: EdgeCandidate[] = [];
  const verticalBuckets = new Map<number, BucketEntry[]>();

  for (const edge of edges) {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) continue;

    const xOut = Math.round(source.right + VIRTUAL_CONDUIT_OFFSET);
    const xIn = Math.round(target.left - VIRTUAL_CONDUIT_OFFSET);
    if (xIn <= xOut) continue;

    const sourceY = handleY(
      source,
      handleBounds,
      edge.source,
      edge.sourceHandle,
      "source",
    );
    const targetY = handleY(
      target,
      handleBounds,
      edge.target,
      edge.targetHandle,
      "target",
    );

    candidates.push({ edgeId: edge.id, xOut, xIn });
    pushBucket(verticalBuckets, xOut, { edgeId: edge.id, y: sourceY });
    pushBucket(verticalBuckets, xIn, { edgeId: edge.id, y: targetY });
  }

  // Order each channel's lanes by port Y (top-most port gets the outermost
  // lane) so edges fanning into stacked ports nest instead of crossing.
  for (const bucket of verticalBuckets.values()) {
    bucket.sort((a, b) => b.y - a.y);
  }

  const result = new Map<string, GuidelineInfo[]>();

  for (const candidate of candidates) {
    result.set(candidate.edgeId, [
      // Output channel hugs the source (on its left) -> fan right, away from it.
      verticalGuideline(verticalBuckets, candidate.xOut, candidate.edgeId, 1),
      // Input channel hugs the target (on its right) -> fan left, away from it.
      verticalGuideline(verticalBuckets, candidate.xIn, candidate.edgeId, -1),
    ]);
  }

  return result;
}

function buildRectMapFull(nodes: Node[]): Map<string, NodeRectFull> {
  const map = new Map<string, NodeRectFull>();

  for (const node of nodes) {
    if (node.type && SKIP_TYPES.has(node.type)) continue;

    const width = node.measured?.width;
    const height = node.measured?.height;
    if (width == null || height == null) continue;

    const left = node.position.x;
    const top = node.position.y;
    map.set(node.id, { left, right: left + width, top, height });
  }

  return map;
}

export interface AlignmentSnap {
  /** Offset to add to every dragged node's x so an edge lines up. */
  dx: number;
  /** Offset to add to every dragged node's y so an edge lines up. */
  dy: number;
  /** X coordinates of the active vertical alignment guides. */
  verticalGuides: number[];
  /** Y coordinates of the active horizontal alignment guides. */
  horizontalGuides: number[];
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface AxisSnap {
  offset: number;
  guides: number[];
}

/**
 * Find the smallest offset that lines up either dragged edge with any target
 * coordinate, staying within `threshold`. Returns the winning offset and the
 * target coordinate(s) the snapped edge lands on (used to draw guide lines).
 */
function snapAxis(
  edges: [number, number],
  targets: number[],
  threshold: number,
): AxisSnap | null {
  let best: number | null = null;
  let bestDistance = threshold;

  for (const edge of edges) {
    for (const target of targets) {
      const distance = Math.abs(target - edge);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = target - edge;
      }
    }
  }

  if (best === null) return null;

  const guides = new Set<number>();
  for (const edge of edges) {
    for (const target of targets) {
      if (Math.abs(target - (edge + best)) < 0.5) guides.add(target);
    }
  }

  return { offset: best, guides: [...guides] };
}

/**
 * Compute a magnetic alignment snap for a set of dragged nodes. The dragged
 * nodes' bounding-box edges (left/right for X, top/bottom for Y) are compared
 * to the matching edges of every other measured node; if the nearest lands
 * within `threshold` (flow units), an offset is returned that lines them up
 * exactly. X and Y snap independently.
 *
 * Returns `null` when there is nothing to snap to (no dragged geometry or no
 * targets within threshold on either axis).
 */
export function computeAlignmentSnap(
  draggedIds: Set<string>,
  nodes: Node[],
  threshold: number,
): AlignmentSnap | null {
  const rects = buildRectMapFull(nodes);

  let dragged: Bounds | null = null;
  const targetX: number[] = [];
  const targetY: number[] = [];

  for (const [id, rect] of rects) {
    const bottom = rect.top + rect.height;
    if (draggedIds.has(id)) {
      if (!dragged) {
        dragged = { left: rect.left, right: rect.right, top: rect.top, bottom };
      } else {
        dragged.left = Math.min(dragged.left, rect.left);
        dragged.right = Math.max(dragged.right, rect.right);
        dragged.top = Math.min(dragged.top, rect.top);
        dragged.bottom = Math.max(dragged.bottom, bottom);
      }
      continue;
    }
    targetX.push(rect.left, rect.right);
    targetY.push(rect.top, bottom);
  }

  if (!dragged) return null;

  const snapX = snapAxis([dragged.left, dragged.right], targetX, threshold);
  const snapY = snapAxis([dragged.top, dragged.bottom], targetY, threshold);

  if (!snapX && !snapY) return null;

  return {
    dx: snapX?.offset ?? 0,
    dy: snapY?.offset ?? 0,
    verticalGuides: snapX?.guides ?? [],
    horizontalGuides: snapY?.guides ?? [],
  };
}

export interface NodeConduitChannels {
  vertical: number[];
  horizontal: number[];
}

/**
 * Derive the virtual conduit channels that surround a set of nodes, independent
 * of any edges. Each node contributes a vertical channel just left of its input
 * (left) edge and just right of its output (right) edge, plus horizontal
 * channels just above and below its rectangle.
 *
 * Used to visualise the routing grid around selected nodes even when they have
 * no connections, so the overlay still reflects where their conduits would run.
 */
export function deriveNodeConduitChannels(nodes: Node[]): NodeConduitChannels {
  const rects = buildRectMapFull(nodes);
  const vertical: number[] = [];
  const horizontal: number[] = [];

  for (const rect of rects.values()) {
    vertical.push(Math.round(rect.left - VIRTUAL_CONDUIT_OFFSET));
    vertical.push(Math.round(rect.right + VIRTUAL_CONDUIT_OFFSET));
    horizontal.push(Math.round(rect.top - VIRTUAL_CONDUIT_OFFSET));
    horizontal.push(
      Math.round(rect.top + rect.height + VIRTUAL_CONDUIT_OFFSET),
    );
  }

  return { vertical, horizontal };
}
