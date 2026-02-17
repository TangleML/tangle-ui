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

  if (preview.type === "attach") {
    return (
      <AttachPreview
        parentBottom={preview.parentBottom}
        parentLeft={preview.parentLeft}
        windowWidth={windowWidth}
      />
    );
  }

  return null;
}

interface EdgeDockPreviewProps {
  side: "left" | "right";
  windowWidth: number;
}

/**
 * Preview overlay for edge docking (left or right side of viewport)
 */
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

interface AttachPreviewProps {
  parentBottom: number;
  parentLeft: number;
  windowWidth: number;
}

/**
 * Preview indicator for vertical window attachment
 */
function AttachPreview({
  parentBottom,
  parentLeft,
  windowWidth,
}: AttachPreviewProps) {
  return (
    <>
      {/* Attachment line indicator */}
      <div
        className="fixed pointer-events-none z-[100] h-1 bg-green-500 rounded-full transition-all duration-75"
        style={{
          left: parentLeft,
          top: parentBottom - 2,
          width: Math.min(windowWidth, 200),
        }}
      />
      {/* Snap zone preview area */}
      <div
        className="fixed pointer-events-none z-[99] bg-green-500/10 border-2 border-green-500/40 border-dashed rounded-lg transition-all duration-75"
        style={{
          left: parentLeft,
          top: parentBottom,
          width: windowWidth,
          height: 100,
        }}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <div className="bg-green-500/80 text-white text-xs px-2 py-0.5 rounded font-medium">
            Attach here
          </div>
        </div>
      </div>
    </>
  );
}

