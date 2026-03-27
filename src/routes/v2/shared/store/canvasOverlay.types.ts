import type { Edge } from "@xyflow/react";
import type { ComponentType, CSSProperties } from "react";

import type { TaskNodeViewProps } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";

/** Visual effect to apply to a single node. All fields are optional; undefined means no change. */
export interface NodeOverlayEffect {
  opacity?: number;
  className?: string;
  hidden?: boolean;
  componentOverride?: ComponentType<TaskNodeViewProps>;
}

/** Visual effect to apply to a single edge. All fields are optional; undefined means no change. */
export interface EdgeOverlayEffect {
  opacity?: number;
  style?: CSSProperties;
  hidden?: boolean;
}

/**
 * A single overlay configuration. The overlay system is agnostic about
 * visual semantics -- it delegates all decisions to the resolver functions.
 */
export interface CanvasOverlayConfig {
  id: string;
  resolveNodeEffect?: (nodeId: string) => NodeOverlayEffect | undefined;
  resolveEdgeEffect?: (edge: Edge) => EdgeOverlayEffect | undefined;
}
