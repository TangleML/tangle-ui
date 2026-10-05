import { useReactFlow, useViewport } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

const FALLBACK_NODE_WIDTH = 300;
const FALLBACK_NODE_HEIGHT = 120;

export const RemoteCursorsOverlay = observer(function RemoteCursorsOverlay() {
  const { collaboration } = useEditorSession();
  const { screenToFlowPosition, getNode } = useReactFlow();
  const { x, y, zoom } = useViewport();

  useEffect(() => {
    if (!collaboration.enabled) return;
    const handlePointerMove = (event: PointerEvent) => {
      collaboration.updateLocalPointer(
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      );
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [collaboration, collaboration.enabled, screenToFlowPosition]);

  if (!collaboration.enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {collaboration.participants.map((actor) => {
        if (actor.actorId === collaboration.actorId) return null;
        return (actor.drags ?? []).map((drag) => {
          const node = getNode(drag.taskId);
          return (
            <DragShadow
              key={`${actor.actorId}:${drag.taskId}`}
              color={actor.color}
              left={drag.position.x * zoom + x}
              top={drag.position.y * zoom + y}
              width={(node?.measured?.width ?? FALLBACK_NODE_WIDTH) * zoom}
              height={(node?.measured?.height ?? FALLBACK_NODE_HEIGHT) * zoom}
            />
          );
        });
      })}
      {collaboration.participants.map((actor) => {
        if (actor.actorId === collaboration.actorId || !actor.position) {
          return null;
        }
        return (
          <RemoteCursor
            key={actor.actorId}
            color={actor.color}
            label={actor.actorId.slice(0, 8)}
            left={actor.position.x * zoom + x}
            top={actor.position.y * zoom + y}
          />
        );
      })}
    </div>
  );
});

interface DragShadowProps {
  color: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function DragShadow({ color, left, top, width, height }: DragShadowProps) {
  return (
    <div
      className="absolute left-0 top-0 rounded-2xl border-2 opacity-25"
      style={{
        transform: `translate(${left}px, ${top}px)`,
        width,
        height,
        backgroundColor: color,
        borderColor: color,
      }}
    />
  );
}

interface RemoteCursorProps {
  color: string;
  label: string;
  left: number;
  top: number;
}

function RemoteCursor({ color, label, left, top }: RemoteCursorProps) {
  return (
    <div
      className="absolute left-0 top-0 flex items-start gap-1"
      style={{ transform: `translate(${left}px, ${top}px)` }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 2 L2 15 L6 11 L9 17 L11 16 L8 10 L14 10 Z"
          fill={color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      <span
        className="rounded px-1 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
    </div>
  );
}
