import type { Edge, Node, ReactFlowState } from "@xyflow/react";
import { useStore, ViewportPortal } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { deriveNodeConduitChannels } from "@/routes/v2/shared/nodes/edges/AvoidNodesEdge/virtualConduits";
import type { GuidelineInfo } from "@/routes/v2/shared/nodes/types";

import { dragSnapStore } from "./dragSnapStore";
import { virtualConduitsOverlayStore } from "./virtualConduitsOverlayStore";

/** Node types that do not participate in virtual conduits. */
const SKIP_TYPES = new Set(["ghost", "conduit"]);

/** Extra space added around the node bounding box so channel lines overrun it. */
const PADDING = 48;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBounds(nodes: Node[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const node of nodes) {
    if (node.type && SKIP_TYPES.has(node.type)) continue;
    const width = node.measured?.width;
    const height = node.measured?.height;
    if (width == null || height == null) continue;

    found = true;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  if (!found) return null;
  return {
    minX: minX - PADDING,
    minY: minY - PADDING,
    maxX: maxX + PADDING,
    maxY: maxY + PADDING,
  };
}

/**
 * Collapse per-edge vertical guidelines into unique channels keyed by x
 * coordinate, keeping the largest bundle size seen for each so shared channels
 * can be annotated with their edge count.
 */
function collectVerticalChannels(
  guidelines: Map<string, GuidelineInfo[]>,
): Map<number, number> {
  const vertical = new Map<number, number>();

  const all = [...guidelines.values()].flat();
  for (const guideline of all) {
    if (guideline.orientation !== "vertical") continue;
    const existing = vertical.get(guideline.coordinate) ?? 0;
    vertical.set(guideline.coordinate, Math.max(existing, guideline.edgeTotal));
  }

  return vertical;
}

/**
 * Serialise selected node ids into a stable, sorted key. Read from React Flow's
 * internal store (the authoritative selection source) so the overlay reacts to
 * selection changes even though it is an `observer` that otherwise only tracks
 * the overlay toggle store.
 */
function selectSelectedNodeIdsKey(state: ReactFlowState): string {
  return state.nodes
    .filter((node) => node.selected)
    .map((node) => node.id)
    .sort()
    .join(",");
}

function selectSelectedEdgeIdsKey(state: ReactFlowState): string {
  return state.edges
    .filter((edge) => edge.selected)
    .map((edge) => edge.id)
    .sort()
    .join(",");
}

function keyToIdSet(key: string): Set<string> {
  return new Set(key ? key.split(",") : []);
}

interface ConduitChannels {
  vertical: Map<number, number>;
  horizontal: Map<number, number>;
}

/**
 * Compute the toggle-driven conduit channels (vertical + horizontal) for the
 * current selection scope. Extracted so the overlay can skip this work when the
 * "Show virtual conduits" toggle is off but still render drag snap guides.
 *
 * Horizontal channels are derived from node top/bottom boundaries so the
 * overlay reflects the grid the router actually travels along.
 */
function computeConduitChannels(
  guidelines: Map<string, GuidelineInfo[]>,
  nodes: Node[],
  edges: Edge[],
  selectedNodeIds: Set<string>,
  selectedEdgeIds: Set<string>,
): ConduitChannels {
  const selectionActive = selectedNodeIds.size > 0 || selectedEdgeIds.size > 0;

  // A selected edge shows the conduits that influence its render; a selected
  // node shows only its own surrounding channels, never the channels of edges
  // merely touching it.
  const relevantEdgeIds = selectionActive
    ? new Set(
        edges
          .filter((edge) => selectedEdgeIds.has(edge.id))
          .map((edge) => edge.id),
      )
    : new Set(edges.map((edge) => edge.id));
  const scopedGuidelines = selectionActive
    ? new Map([...guidelines].filter(([id]) => relevantEdgeIds.has(id)))
    : guidelines;

  const boundaryNodes = selectionActive
    ? nodes.filter((node) => selectedNodeIds.has(node.id))
    : nodes;
  const channels = deriveNodeConduitChannels(boundaryNodes);

  const vertical = collectVerticalChannels(scopedGuidelines);
  const horizontal = new Map<number, number>();
  for (const coordinate of channels.horizontal) {
    if (!horizontal.has(coordinate)) horizontal.set(coordinate, 1);
  }

  if (selectionActive) {
    for (const coordinate of channels.vertical) {
      if (!vertical.has(coordinate)) vertical.set(coordinate, 1);
    }
  }

  return { vertical, horizontal };
}

interface VirtualConduitsOverlayProps {
  guidelines: Map<string, GuidelineInfo[]>;
  nodes: Node[];
  edges: Edge[];
}

/**
 * Pointer-transparent auxiliary layer that draws the derived virtual conduit
 * channels (the routing grid) over the canvas. Rendered inside `ViewportPortal`
 * so the lines pan/zoom in lockstep with the flow, and disabled entirely when
 * the overlay toggle is off.
 */
export const VirtualConduitsOverlay = observer(function VirtualConduitsOverlay({
  guidelines,
  nodes,
  edges,
}: VirtualConduitsOverlayProps) {
  const selectedNodeIdsKey = useStore(selectSelectedNodeIdsKey);
  const selectedEdgeIdsKey = useStore(selectSelectedEdgeIdsKey);

  const overlayActive = virtualConduitsOverlayStore.active;
  const snapVertical = dragSnapStore.verticalGuides;
  const snapHorizontal = dragSnapStore.horizontalGuides;
  const hasSnapGuides = snapVertical.length > 0 || snapHorizontal.length > 0;

  if (!overlayActive && !hasSnapGuides) return null;

  const bounds = computeBounds(nodes);
  if (!bounds) return null;

  const { vertical, horizontal } = overlayActive
    ? computeConduitChannels(
        guidelines,
        nodes,
        edges,
        keyToIdSet(selectedNodeIdsKey),
        keyToIdSet(selectedEdgeIdsKey),
      )
    : {
        vertical: new Map<number, number>(),
        horizontal: new Map<number, number>(),
      };

  const height = bounds.maxY - bounds.minY;
  const width = bounds.maxX - bounds.minX;

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute top-0 left-0">
        {[...vertical].map(([coordinate, total]) => (
          <div key={`v-${coordinate}`}>
            <div
              className="pointer-events-none absolute border-l border-dashed border-sky-400/70"
              style={{ left: coordinate, top: bounds.minY, height }}
            />
            {total > 1 && (
              <div
                className="pointer-events-none absolute text-[10px] leading-none text-sky-500"
                style={{ left: coordinate + 4, top: bounds.minY - 14 }}
              >
                {total}
              </div>
            )}
          </div>
        ))}
        {[...horizontal].map(([coordinate, total]) => (
          <div key={`h-${coordinate}`}>
            <div
              className="pointer-events-none absolute border-t border-dashed border-amber-500/70"
              style={{ left: bounds.minX, top: coordinate, width }}
            />
            {total > 1 && (
              <div
                className="pointer-events-none absolute text-[10px] leading-none text-amber-600"
                style={{ left: bounds.minX - 16, top: coordinate + 2 }}
              >
                {total}
              </div>
            )}
          </div>
        ))}
        {snapVertical.map((coordinate) => (
          <div
            key={`snap-v-${coordinate}`}
            className="pointer-events-none absolute border-l border-rose-500"
            style={{ left: coordinate, top: bounds.minY, height }}
          />
        ))}
        {snapHorizontal.map((coordinate) => (
          <div
            key={`snap-h-${coordinate}`}
            className="pointer-events-none absolute border-t border-rose-500"
            style={{ left: bounds.minX, top: coordinate, width }}
          />
        ))}
      </div>
    </ViewportPortal>
  );
});
