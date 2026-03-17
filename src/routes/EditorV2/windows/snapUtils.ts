import type { Position, Size, SnapPreviewType, WindowConfig } from "./types";
import {
  DETACH_THRESHOLD,
  DOCK_AREA_SNAP_THRESHOLD,
  EDGE_SNAP_THRESHOLD,
  MAGNETIC_SNAP_THRESHOLD,
} from "./types";

function isNearLeftEdge(x: number): boolean {
  return x <= EDGE_SNAP_THRESHOLD;
}

function isNearRightEdge(x: number, windowWidth: number): boolean {
  const rightEdge = x + windowWidth;
  return rightEdge >= window.innerWidth - EDGE_SNAP_THRESHOLD;
}

function detectEdgeSnap(
  position: Position,
  size: Size,
): { side: "left" | "right" } | null {
  if (isNearLeftEdge(position.x)) {
    return { side: "left" };
  }
  if (isNearRightEdge(position.x, size.width)) {
    return { side: "right" };
  }
  return null;
}

export function getWindowBottom(window: WindowConfig): number {
  return window.position.y + window.size.height;
}

function findMagneticAttachTarget(
  draggedWindowId: string,
  draggedPosition: Position,
  allWindows: WindowConfig[],
): WindowConfig | null {
  let closestWindow: WindowConfig | null = null;
  let closestDistance = Infinity;

  for (const win of allWindows) {
    if (
      win.id === draggedWindowId ||
      win.state === "hidden" ||
      win.state === "minimized" ||
      win.dockState !== "none"
    ) {
      continue;
    }

    const windowBottom = getWindowBottom(win);
    const distance = Math.abs(draggedPosition.y - windowBottom);

    if (distance <= MAGNETIC_SNAP_THRESHOLD && distance < closestDistance) {
      closestDistance = distance;
      closestWindow = win;
    }
  }

  return closestWindow;
}

export function shouldDetach(
  currentPosition: Position,
  attachedPosition: Position,
): boolean {
  const dx = Math.abs(currentPosition.x - attachedPosition.x);
  const dy = Math.abs(currentPosition.y - attachedPosition.y);
  return dx >= DETACH_THRESHOLD || dy >= DETACH_THRESHOLD;
}

export function calculateAttachPosition(parentWindow: WindowConfig): Position {
  return {
    x: parentWindow.position.x,
    y: getWindowBottom(parentWindow),
  };
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

/**
 * Detect if the cursor is inside or near a dock area.
 * Returns the side and insertion index if applicable.
 */
function detectDockAreaSnap(
  mouseX: number,
  mouseY: number,
  windowId: string,
  dockAreaWindowIds: Record<"left" | "right", string[]>,
): SnapPreviewType | null {
  for (const side of ["left", "right"] as const) {
    const el = dockAreaElements[side];

    // If dock area exists, check if mouse is inside it
    if (el) {
      const rect = el.getBoundingClientRect();
      if (
        mouseX >= rect.left - DOCK_AREA_SNAP_THRESHOLD &&
        mouseX <= rect.right + DOCK_AREA_SNAP_THRESHOLD &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
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

    // No dock area element - check viewport edge for creating a new dock area
    if (side === "left" && mouseX <= DOCK_AREA_SNAP_THRESHOLD) {
      return { type: "edge", side: "left" };
    }
    if (
      side === "right" &&
      mouseX >= window.innerWidth - DOCK_AREA_SNAP_THRESHOLD
    ) {
      return { type: "edge", side: "right" };
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
 * Checks dock areas first (highest priority), then edge snap, then magnetic attachment.
 */
interface DetectSnapPreviewOptions {
  windowId: string;
  position: Position;
  size: Size;
  allWindows: WindowConfig[];
  isAttached: boolean;
  attachedPosition?: Position;
  mousePosition?: Position;
  dockAreaWindowIds?: Record<"left" | "right", string[]>;
}

export function detectSnapPreview(
  options: DetectSnapPreviewOptions,
): SnapPreviewType | null {
  const {
    windowId,
    position,
    size,
    allWindows,
    isAttached,
    attachedPosition,
    mousePosition,
    dockAreaWindowIds,
  } = options;

  if (isAttached && attachedPosition) {
    if (!shouldDetach(position, attachedPosition)) {
      return null;
    }
  }

  if (mousePosition && dockAreaWindowIds) {
    const dockSnap = detectDockAreaSnap(
      mousePosition.x,
      mousePosition.y,
      windowId,
      dockAreaWindowIds,
    );
    if (dockSnap) return dockSnap;
  }

  const edgeSnap = detectEdgeSnap(position, size);
  if (edgeSnap) {
    return { type: "edge", side: edgeSnap.side };
  }

  const floatingWindows = allWindows.filter((w) => w.dockState === "none");
  const attachTarget = findMagneticAttachTarget(
    windowId,
    position,
    floatingWindows,
  );
  if (attachTarget) {
    return {
      type: "attach",
      parentId: attachTarget.id,
      parentBottom: getWindowBottom(attachTarget),
      parentLeft: attachTarget.position.x,
    };
  }

  return null;
}

export function getAttachmentChain(
  parentId: string,
  allWindows: WindowConfig[],
): WindowConfig[] {
  const chain: WindowConfig[] = [];

  function findChildren(currentParentId: string) {
    for (const win of allWindows) {
      if (win.attachedTo?.parentId === currentParentId) {
        chain.push(win);
        findChildren(win.id);
      }
    }
  }

  findChildren(parentId);
  return chain;
}
