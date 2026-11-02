import type { ReactElement } from "react";

import type { NodeOverlayEffect } from "@/routes/v2/shared/store/canvasOverlay.types";

export function NodeEffectWrapper({
  effect,
  children,
}: {
  effect: NodeOverlayEffect | undefined;
  children: ReactElement;
}) {
  // Always the same element, effect or not: switching between a bare child and a
  // wrapped one remounts the node card and drops its local state, such as which
  // collapsed sections are expanded.
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
