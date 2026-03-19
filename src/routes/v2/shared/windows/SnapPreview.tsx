import { TOP_NAV_HEIGHT } from "@/utils/constants";

import type { SnapPreviewType } from "./types";

interface SnapPreviewProps {
  preview: SnapPreviewType;
  windowWidth: number;
}

/**
 * Visual feedback overlay shown during window drag operations.
 * Displays where the window will snap to if released.
 */
export function SnapPreview({ preview, windowWidth }: SnapPreviewProps) {
  if (preview.type === "edge") {
    return <EdgeDockPreview side={preview.side} windowWidth={windowWidth} />;
  }

  if (preview.type === "dock-insert") {
    return (
      <DockInsertPreview
        indicatorY={preview.indicatorY}
        areaLeft={preview.areaLeft}
        areaWidth={preview.areaWidth}
      />
    );
  }

  return null;
}

interface EdgeDockPreviewProps {
  side: "left" | "right";
  windowWidth: number;
}

function EdgeDockPreview({ side, windowWidth }: EdgeDockPreviewProps) {
  const viewportHeight = window.innerHeight - TOP_NAV_HEIGHT;

  return (
    <div
      className="fixed pointer-events-none z-[100] bg-blue-500/20 border-2 border-blue-500/50 border-dashed rounded-lg transition-all duration-150"
      style={{
        left: side === "left" ? 0 : window.innerWidth - windowWidth,
        top: TOP_NAV_HEIGHT,
        width: windowWidth,
        height: viewportHeight,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-blue-500/80 text-white text-xs px-2 py-1 rounded font-medium">
          Dock {side}
        </div>
      </div>
    </div>
  );
}

interface DockInsertPreviewProps {
  indicatorY: number;
  areaLeft: number;
  areaWidth: number;
}

/**
 * Horizontal line indicator showing where a window will be inserted in a dock area.
 */
function DockInsertPreview({
  indicatorY,
  areaLeft,
  areaWidth,
}: DockInsertPreviewProps) {
  const padding = 8;
  return (
    <div
      className="fixed pointer-events-none z-[100] transition-all duration-75"
      style={{
        left: areaLeft + padding,
        top: indicatorY - 2,
        width: areaWidth - padding * 2,
        height: 4,
      }}
    >
      <div className="h-full bg-blue-500 rounded-full" />
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
    </div>
  );
}
