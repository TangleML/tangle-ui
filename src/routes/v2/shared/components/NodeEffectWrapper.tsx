import type { ReactElement } from "react";

import type { NodeOverlayEffect } from "@/routes/v2/shared/store/canvasOverlay.types";

export function NodeEffectWrapper({
  effect,
  children,
}: {
  effect: NodeOverlayEffect | undefined;
  children: ReactElement;
}) {
  if (!effect?.className && effect?.opacity === undefined) {
    return children;
  }
  return (
    <div
      className={effect?.className}
      style={
        effect?.opacity !== undefined ? { opacity: effect.opacity } : undefined
      }
    >
      {children}
    </div>
  );
}
