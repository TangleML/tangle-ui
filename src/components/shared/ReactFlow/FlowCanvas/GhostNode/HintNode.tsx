import { type NodeProps, useReactFlow } from "@xyflow/react";
import { memo, type PropsWithChildren } from "react";

import { cn } from "@/lib/utils";
import type { HintNodeData } from "@/types/hintNode";

const HintNode = ({ data }: NodeProps) => {
  const { getZoom } = useReactFlow();
  const typedData = data as HintNodeData;

  const zoom = getZoom();

  const baseOffsetX = 12;
  const baseOffsetY = -12;

  const minScale = 0.8;
  const maxScale = 10;
  const scaleMultiplier = 1.2;

  const scale = Math.min(maxScale, Math.max(minScale, scaleMultiplier / zoom));

  const transformOrigin =
    typedData.side === "left" ? "center right" : "center left";

  const offsetX =
    (typedData.side === "left" ? -baseOffsetX : baseOffsetX) * scale;
  const offsetY = baseOffsetY; // No scaling needed for Y because the transformY origin is set to center

  return (
    <div
      className={cn(
        "flex items-center gap-2 opacity-90 select-none pointer-events-none",
        typedData.side === "left" ? "-translate-x-full" : "",
      )}
      style={{
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        transformOrigin,
      }}
    >
      <KeyboardKey>{typedData.key}</KeyboardKey>
      <div className="text-gray-600/60 text-xs font-normal select-none opacity-70">
        {typedData.hint}
      </div>
    </div>
  );
};

export default memo(HintNode);

const KeyboardKey = ({ children }: PropsWithChildren) => {
  return (
    <div
      className="
      px-2 py-1
      border border-gray-300/60
      rounded-md
      shadow-md
      backdrop-blur-sm
      text-gray-700/80
      text-xs
      font-medium
      select-none
      bg-gradient-to-br
      from-white/80
      to-gray-100/70
      "
    >
      {children}
    </div>
  );
};
