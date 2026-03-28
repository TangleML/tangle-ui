import { useRef, useState } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { detectSnapPreview } from "@/routes/v2/shared/windows/snapUtils";
import type {
  Position,
  SnapPreviewType,
} from "@/routes/v2/shared/windows/types";

// ---------------------------------------------------------------------------
// Drag phase state machine
// ---------------------------------------------------------------------------

/** Distance (px) from origin mouse position before undocking a docked window. */
const UNDOCK_THRESHOLD = 20;

type DragPhase =
  | { type: "idle" }
  | { type: "docked-pending"; originMouse: Position }
  | { type: "free" };

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseWindowDragOptions {
  windowId: string;
  docked: boolean;
}

interface UseWindowDragReturn {
  isDragging: boolean;
  snapPreview: SnapPreviewType | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
  handleHeaderMouseDown: (e: React.MouseEvent) => void;
  handleContainerMouseDown: () => void;
  handleContainerClick: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useWindowDrag({
  windowId,
  docked,
}: UseWindowDragOptions): UseWindowDragReturn {
  const { windows } = useSharedStores();
  const windowConfig = windows.getWindowById(windowId);
  const isAtFront = windows.isWindowAtFront(windowId);

  const [isDragging, setIsDragging] = useState(false);
  const [snapPreview, setSnapPreview] = useState<SnapPreviewType | null>(null);

  const phaseRef = useRef<DragPhase>({ type: "idle" });
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const snapPreviewRef = useRef<SnapPreviewType | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const position = windowConfig?.position ?? { x: 0, y: 0 };
  const size = windowConfig?.size ?? { width: 320, height: 420 };
  const isDocked =
    windowConfig?.dockState !== undefined && windowConfig?.dockState !== "none";

  // Optimistic z-index bump: the MobX re-render from bringToFront (on mouseup)
  // will set the final z-index, but this prevents a visible flicker during drag
  // start where the window would briefly stay behind others.
  const raiseZIndex = () => {
    if (!docked && !isAtFront && panelRef.current) {
      panelRef.current.style.zIndex = String(20 + windows.windowOrderLength);
    }
  };

  const handleContainerMouseDown = () => {
    raiseZIndex();
  };

  const handleContainerClick = () => {
    if (!isAtFront) {
      windows.bringToFront(windowId);
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("button")) return;

    raiseZIndex();
    setIsDragging(true);

    // Compute drag offset depending on rendering mode
    if (docked) {
      const rect = panelRef.current?.getBoundingClientRect();
      dragOffset.current = {
        x: rect ? e.clientX - rect.left : 0,
        y: rect ? e.clientY - rect.top : 0,
      };

      if (isDocked) {
        phaseRef.current = {
          type: "docked-pending",
          originMouse: { x: e.clientX, y: e.clientY },
        };
      } else {
        phaseRef.current = { type: "free" };
      }
    } else {
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      phaseRef.current = { type: "free" };
    }

    const handleMouseMove = (moveE: MouseEvent) => {
      const phase = phaseRef.current;
      let newPosition = {
        x: moveE.clientX - dragOffset.current.x,
        y: moveE.clientY - dragOffset.current.y,
      };

      // --- Phase: docked-pending ---
      if (phase.type === "docked-pending") {
        const dx = Math.abs(moveE.clientX - phase.originMouse.x);
        const dy = Math.abs(moveE.clientY - phase.originMouse.y);
        if (dx <= UNDOCK_THRESHOLD && dy <= UNDOCK_THRESHOLD) return;

        windows.undockWindow(windowId);
        phaseRef.current = { type: "free" };

        // Center the floating window under the cursor
        const win = windows.getWindowById(windowId);
        if (win) {
          const halfWidth = win.size.width / 2;
          const headerGrab = 20;
          dragOffset.current = { x: halfWidth, y: headerGrab };
          newPosition = {
            x: moveE.clientX - halfWidth,
            y: moveE.clientY - headerGrab,
          };
        }
      }

      // --- Phase: free ---
      windows.updateWindowPosition(windowId, newPosition);

      if (windows.isWindowDocked(windowId)) {
        windows.undockWindow(windowId);
      }

      const preview = detectSnapPreview({
        windowId,
        position: newPosition,
        size,
        mousePosition: { x: moveE.clientX, y: moveE.clientY },
        dockAreaWindowIds: {
          left: [...windows.getDockAreaWindowIds("left")],
          right: [...windows.getDockAreaWindowIds("right")],
        },
        enabledDockSides: windows.enabledDockSides,
      });
      snapPreviewRef.current = preview;
      setSnapPreview(preview);
    };

    const handleMouseUp = () => {
      const currentPreview = snapPreviewRef.current;

      if (currentPreview) {
        if (currentPreview.type === "edge") {
          windows.dockWindow(windowId, currentPreview.side);
        } else if (currentPreview.type === "dock-insert") {
          windows.dockWindow(
            windowId,
            currentPreview.side,
            currentPreview.insertIndex,
          );
        }
      }

      if (!isAtFront) {
        windows.bringToFront(windowId);
      }
      setIsDragging(false);
      setSnapPreview(null);
      snapPreviewRef.current = null;
      phaseRef.current = { type: "idle" };
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return {
    isDragging,
    snapPreview,
    panelRef,
    handleHeaderMouseDown,
    handleContainerMouseDown,
    handleContainerClick,
  };
}
