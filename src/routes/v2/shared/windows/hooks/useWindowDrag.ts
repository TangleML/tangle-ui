import { useRef, useState } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
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
  docked,
}: UseWindowDragOptions): UseWindowDragReturn {
  const { model } = useWindowContext();
  const { windows } = useSharedStores();

  const [isDragging, setIsDragging] = useState(false);
  const [snapPreview, setSnapPreview] = useState<SnapPreviewType | null>(null);

  /**
   * The following refs are read/written inside imperative `mousemove`/`mouseup`
   * event listeners attached to `document`. These closures outlive React's
   * render cycle, so stable mutable containers (`useRef`) are required instead
   * of React state.
   */
  const phaseRef = useRef<DragPhase>({ type: "idle" });
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const snapPreviewRef = useRef<SnapPreviewType | null>(null);
  /** Standard DOM ref for the panel element. */
  const panelRef = useRef<HTMLDivElement>(null);

  const raiseZIndex = () => {
    if (!docked && !model.isAtFront && panelRef.current) {
      panelRef.current.style.zIndex = String(20 + windows.windowOrderLength);
    }
  };

  const handleContainerMouseDown = () => {
    raiseZIndex();
  };

  const handleContainerClick = () => {
    if (!model.isAtFront) {
      model.bringToFront();
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("button")) return;

    raiseZIndex();
    setIsDragging(true);

    if (docked) {
      const rect = panelRef.current?.getBoundingClientRect();
      dragOffset.current = {
        x: rect ? e.clientX - rect.left : 0,
        y: rect ? e.clientY - rect.top : 0,
      };

      if (model.isDocked) {
        phaseRef.current = {
          type: "docked-pending",
          originMouse: { x: e.clientX, y: e.clientY },
        };
      } else {
        phaseRef.current = { type: "free" };
      }
    } else {
      dragOffset.current = {
        x: e.clientX - model.position.x,
        y: e.clientY - model.position.y,
      };
      phaseRef.current = { type: "free" };
    }

    const handleMouseMove = (moveE: MouseEvent) => {
      const phase = phaseRef.current;
      let newPosition = {
        x: moveE.clientX - dragOffset.current.x,
        y: moveE.clientY - dragOffset.current.y,
      };

      if (phase.type === "docked-pending") {
        const dx = Math.abs(moveE.clientX - phase.originMouse.x);
        const dy = Math.abs(moveE.clientY - phase.originMouse.y);
        if (dx <= UNDOCK_THRESHOLD && dy <= UNDOCK_THRESHOLD) return;

        model.undock();
        phaseRef.current = { type: "free" };

        const halfWidth = model.size.width / 2;
        const headerGrab = 20;
        dragOffset.current = { x: halfWidth, y: headerGrab };
        newPosition = {
          x: moveE.clientX - halfWidth,
          y: moveE.clientY - headerGrab,
        };
      }

      model.updatePosition(newPosition);

      if (model.isDocked) {
        model.undock();
      }

      const preview = detectSnapPreview({
        windowId: model.id,
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
          model.dock(currentPreview.side);
        } else if (currentPreview.type === "dock-insert") {
          model.dock(currentPreview.side, currentPreview.insertIndex);
        }
      }

      if (!model.isAtFront) {
        model.bringToFront();
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
