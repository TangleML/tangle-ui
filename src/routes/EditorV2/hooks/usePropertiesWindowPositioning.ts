import { useReactFlow } from "@xyflow/react";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { useFlagValue } from "@/components/shared/Settings/useFlags";

import { editorStore } from "../store/editorStore";
import type { Position } from "../windows/types";
import { COLLAPSED_DOCK_AREA_WIDTH } from "../windows/types";
import {
  getWindowById,
  updateWindowPosition,
  windowStore,
} from "../windows/windowStore";

const CONTEXT_PANEL_WINDOW_ID = "context-panel";
const GAP = 12;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function getDockAreaWidth(side: "left" | "right"): number {
  const area = windowStore.dockAreas[side];
  return area.collapsed ? COLLAPSED_DOCK_AREA_WIDTH : area.width;
}

function getAvailableBounds(): Bounds {
  return {
    left: getDockAreaWidth("left"),
    top: 0,
    right: window.innerWidth - getDockAreaWidth("right"),
    bottom: window.innerHeight,
  };
}

function clampPosition(
  pos: Position,
  windowWidth: number,
  windowHeight: number,
  bounds: Bounds,
): Position {
  return {
    x: Math.max(bounds.left, Math.min(pos.x, bounds.right - windowWidth)),
    y: Math.max(bounds.top, Math.min(pos.y, bounds.bottom - windowHeight)),
  };
}

/**
 * Try placements in priority order: right, left, below, above.
 * Returns the first position that fits entirely within the available bounds,
 * or a clamped fallback if none fits.
 */
function calculateWindowPosition(
  nodeRect: Rect,
  windowWidth: number,
  windowHeight: number,
  bounds: Bounds,
): Position {
  const candidates: Position[] = [
    { x: nodeRect.right + GAP, y: nodeRect.top },
    { x: nodeRect.left - GAP - windowWidth, y: nodeRect.top },
    { x: nodeRect.left, y: nodeRect.bottom + GAP },
    { x: nodeRect.left, y: nodeRect.top - GAP - windowHeight },
  ];

  for (const pos of candidates) {
    if (
      pos.x >= bounds.left &&
      pos.x + windowWidth <= bounds.right &&
      pos.y >= bounds.top &&
      pos.y + windowHeight <= bounds.bottom
    ) {
      return pos;
    }
  }

  return clampPosition(candidates[0], windowWidth, windowHeight, bounds);
}

/**
 * When the feature flag is enabled and a single node is selected,
 * positions the floating Properties window adjacent to the selected node.
 */
export function usePropertiesWindowPositioning() {
  const enabled = useFlagValue("snap-properties-to-node");
  const reactFlow = useReactFlow();
  const reactFlowRef = useRef(reactFlow);
  reactFlowRef.current = reactFlow;

  useEffect(() => {
    if (!enabled) return;

    const dispose = reaction(
      () => ({
        selectedNodeId: editorStore.selectedNodeId,
        multiSelectionLength: editorStore.multiSelection.length,
      }),
      ({ selectedNodeId, multiSelectionLength }) => {
        if (!selectedNodeId || multiSelectionLength > 1) return;

        // Defer so useSelectionWindowSync's reaction opens the window first
        queueMicrotask(() => {
          const win = getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (!win || win.dockState !== "none") return;

          const rf = reactFlowRef.current;
          const node = rf.getNode(selectedNodeId);
          if (!node?.measured?.width || !node.measured.height) return;

          const topLeft = rf.flowToScreenPosition(node.position);
          const bottomRight = rf.flowToScreenPosition({
            x: node.position.x + node.measured.width,
            y: node.position.y + node.measured.height,
          });
          const nodeRect: Rect = {
            left: topLeft.x,
            top: topLeft.y,
            right: bottomRight.x,
            bottom: bottomRight.y,
          };

          const bounds = getAvailableBounds();
          const position = calculateWindowPosition(
            nodeRect,
            win.size.width,
            win.size.height,
            bounds,
          );

          updateWindowPosition(CONTEXT_PANEL_WINDOW_ID, position);
        });
      },
    );

    return dispose;
  }, [enabled]);
}
