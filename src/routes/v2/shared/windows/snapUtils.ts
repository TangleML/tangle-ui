import type { Position, SnapPreviewType } from "./types";
import { DOCK_AREA_SNAP_THRESHOLD, EDGE_SNAP_THRESHOLD } from "./types";

function isNearLeftEdge(x: number): boolean {
  return x <= EDGE_SNAP_THRESHOLD;
}

function isNearRightEdge(mouseX: number): boolean {
  return mouseX >= window.innerWidth - EDGE_SNAP_THRESHOLD;
}

function detectEdgeSnap(
  mouseX: number,
  enabledSides: ReadonlySet<"left" | "right">,
): { side: "left" | "right" } | null {
  if (enabledSides.has("left") && isNearLeftEdge(mouseX)) {
    return { side: "left" };
  }
  if (enabledSides.has("right") && isNearRightEdge(mouseX)) {
    return { side: "right" };
  }
  return null;
}

// ============================================================================
// Dock Area Insertion Detection
// ============================================================================

/** DOM element refs for dock areas, set by DockArea components */
const dockAreaElements: Record<"left" | "right", HTMLElement | null> = {
  left: null,
  right: null,
};

export function registerDockAreaElement(
  side: "left" | "right",
  element: HTMLElement | null,
): void {
  dockAreaElements[side] = element;
}

function isMouseInsideDockArea(
  mouseX: number,
  mouseY: number,
  rect: DOMRect,
): boolean {
  return (
    mouseX >= rect.left - DOCK_AREA_SNAP_THRESHOLD &&
    mouseX <= rect.right + DOCK_AREA_SNAP_THRESHOLD &&
    mouseY >= rect.top &&
    mouseY <= rect.bottom
  );
}

function isNearDockEdge(side: "left" | "right", mouseX: number): boolean {
  if (side === "left") return mouseX <= DOCK_AREA_SNAP_THRESHOLD;
  return mouseX >= window.innerWidth - DOCK_AREA_SNAP_THRESHOLD;
}

/**
 * Detect if the cursor is inside or near a dock area.
 * Returns the side and insertion index if applicable.
 */
function detectDockAreaSnap(
  mouseX: number,
  mouseY: number,
  windowId: string,
  dockAreaWindowIds: Record<"left" | "right", string[]>,
  enabledSides: ReadonlySet<"left" | "right">,
): SnapPreviewType | null {
  for (const side of ["left", "right"] as const) {
    if (!enabledSides.has(side)) continue;
    const el = dockAreaElements[side];

    if (el) {
      const rect = el.getBoundingClientRect();
      if (isMouseInsideDockArea(mouseX, mouseY, rect)) {
        const { insertIndex, indicatorY } = calculateInsertPosition(
          el,
          mouseY,
          windowId,
          dockAreaWindowIds[side],
        );
        return {
          type: "dock-insert",
          side,
          insertIndex,
          indicatorY,
          areaLeft: rect.left,
          areaWidth: rect.width,
        };
      }
      continue;
    }

    if (isNearDockEdge(side, mouseX)) {
      return { type: "edge", side };
    }
  }

  return null;
}

/**
 * Calculate the insertion index and Y position for the drop indicator
 * based on mouse Y position relative to docked window elements.
 */
function calculateInsertPosition(
  dockAreaEl: HTMLElement,
  mouseY: number,
  draggedWindowId: string,
  windowIds: string[],
): { insertIndex: number; indicatorY: number } {
  const scrollContainer =
    dockAreaEl.querySelector<HTMLElement>("[data-dock-scroll]");
  const container = scrollContainer ?? dockAreaEl;

  const windowEls =
    container.querySelectorAll<HTMLElement>("[data-dock-window]");

  if (windowEls.length === 0) {
    const rect = container.getBoundingClientRect();
    return { insertIndex: 0, indicatorY: rect.top + 4 };
  }

  // Find insertion point between existing windows
  for (let i = 0; i < windowEls.length; i++) {
    const winEl = windowEls[i];
    const winId = winEl.getAttribute("data-dock-window");

    // Skip the window being dragged
    if (winId === draggedWindowId) continue;

    const rect = winEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (mouseY < midY) {
      // Determine the real index in windowIds (excluding the dragged window)
      const realIndex = windowIds.indexOf(winId ?? "");
      return {
        insertIndex: Math.max(0, realIndex),
        indicatorY: rect.top,
      };
    }
  }

  // After all windows - insert at end
  const lastEl = windowEls[windowEls.length - 1];
  const lastRect = lastEl.getBoundingClientRect();
  return {
    insertIndex: windowIds.length,
    indicatorY: lastRect.bottom,
  };
}

/**
 * Detect all snap possibilities for the current drag state.
 * Checks dock areas first (highest priority), then edge snap.
 */
interface DetectSnapPreviewOptions {
  windowId: string;
  mousePosition?: Position;
  dockAreaWindowIds?: Record<"left" | "right", string[]>;
  enabledDockSides?: ReadonlySet<"left" | "right">;
}

export function detectSnapPreview(
  options: DetectSnapPreviewOptions,
): SnapPreviewType | null {
  const {
    windowId,
    mousePosition,
    dockAreaWindowIds,
    enabledDockSides = new Set(["left", "right"] as const),
  } = options;

  if (!mousePosition) return null;

  if (dockAreaWindowIds) {
    const dockSnap = detectDockAreaSnap(
      mousePosition.x,
      mousePosition.y,
      windowId,
      dockAreaWindowIds,
      enabledDockSides,
    );
    if (dockSnap) return dockSnap;
  }

  const edgeSnap = detectEdgeSnap(mousePosition.x, enabledDockSides);
  if (edgeSnap) {
    return { type: "edge", side: edgeSnap.side };
  }

  return null;
}
