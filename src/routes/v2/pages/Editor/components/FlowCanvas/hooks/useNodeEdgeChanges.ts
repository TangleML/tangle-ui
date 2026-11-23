import type {
  EdgeChange,
  Node,
  NodeChange,
  ReactFlowProps,
  XYPosition,
} from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { computeAlignmentSnap } from "@/routes/v2/shared/nodes/edges/AvoidNodesEdge/virtualConduits";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { dragSnapStore } from "@/routes/v2/shared/overlays/virtualConduits/dragSnapStore";

/** Magnetic snap radius, measured in screen pixels (zoom-corrected to flow units). */
const SNAP_THRESHOLD_SCREEN_PX = 8;

interface PositionChange {
  id: string;
  position: XYPosition;
  dragging?: boolean;
}

function collectPositionChanges(changes: NodeChange[]): PositionChange[] {
  const result: PositionChange[] = [];
  for (const change of changes) {
    if (change.type !== "position" || !change.position) continue;
    result.push({
      id: change.id,
      position: change.position,
      dragging: change.dragging,
    });
  }
  return result;
}

/**
 * Nudge the pending drag positions so the selection's bounding-box edges align
 * with nearby nodes, and publish the active guide lines for the overlay. The
 * offset is applied to the underlying change objects so both the live render
 * and the eventual spec commit use the snapped position.
 */
function applyAlignmentSnap(
  positionChanges: PositionChange[],
  getNodes: () => Node[],
  zoom: number,
): void {
  const draggedIds = new Set(positionChanges.map((change) => change.id));
  const proposed = new Map(
    positionChanges.map((change) => [change.id, change.position]),
  );

  const nodes = getNodes().map((node) => {
    const next = proposed.get(node.id);
    return next ? { ...node, position: next } : node;
  });

  const threshold = SNAP_THRESHOLD_SCREEN_PX / (zoom || 1);
  const snap = computeAlignmentSnap(draggedIds, nodes, threshold);

  // Apply the snap on every event (including the final `dragging === false`
  // drop) so the committed spec position matches what the user saw.
  if (snap) {
    for (const change of positionChanges) {
      change.position.x += snap.dx;
      change.position.y += snap.dy;
    }
  }

  const dragging = positionChanges.some((change) => change.dragging);

  // Guides are only shown mid-drag; clear them on drop or when nothing snaps.
  if (dragging && snap) {
    dragSnapStore.setGuides(snap.verticalGuides, snap.horizontalGuides);
  } else {
    dragSnapStore.clear();
  }
}

export function useNodeEdgeChanges(
  spec: ComponentSpec | null,
  rfOnNodesChange: (changes: NodeChange[]) => void,
  rfOnEdgesChange: (changes: EdgeChange[]) => void,
): Required<Pick<ReactFlowProps, "onNodesChange" | "onEdgesChange">> {
  const registry = useNodeRegistry();
  const { undo } = useEditorSession();
  const { getNodes, getViewport } = useReactFlow();

  const onNodesChange = (changes: NodeChange[]) => {
    const rfChanges = changes.filter((c) => c.type !== "remove");

    const dragPositionChanges = collectPositionChanges(rfChanges);
    if (dragPositionChanges.length > 0) {
      applyAlignmentSnap(dragPositionChanges, getNodes, getViewport().zoom);
    } else {
      dragSnapStore.clear();
    }

    if (!spec) {
      rfOnNodesChange(rfChanges);
      return;
    }

    const positionChanges = changes.filter(
      (change) => change.type === "position" && change.dragging === false,
    );

    if (positionChanges.length > 0) {
      // todo: move action to a separate file
      undo.withGroup("Move nodes", () => {
        for (const change of positionChanges) {
          if ("id" in change && "position" in change && change.position) {
            const manifest = registry.getByNodeId(spec, change.id);
            manifest?.updatePosition(undo, spec, change.id, change.position);
          }
        }
      });
    }

    rfOnNodesChange(rfChanges);
  };

  // Edge/node deletes go through React Flow (`deleteKeyCode` or `deleteElements`) +
  // `runFlowCanvasOnBeforeDelete` (spec + undo), which aborts RF removal; RF may
  // still emit `remove` changes — drop them so we don't double-apply.
  // `useFlowCanvasState` re-syncs nodes/edges from the spec.
  const onEdgesChange = (changes: EdgeChange[]) => {
    rfOnEdgesChange(changes.filter((c) => c.type !== "remove"));
  };

  return { onNodesChange, onEdgesChange };
}
