import type { Edge, Node } from "@xyflow/react";
import type { MouseEvent } from "react";

import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import type {
  CanvasEnhancementParams,
  CanvasEnhancementResult,
} from "@/routes/v2/shared/nodes/types";

const NOOP_ENHANCEMENT = (): CanvasEnhancementResult => ({});

interface CanvasEnhancementsOutput {
  nodes: Node[];
  edges: Edge[];
  onEdgeClick: ((event: MouseEvent, edge: { id: string }) => void) | undefined;
}

/**
 * Composing hook that iterates every registered manifest's
 * `useCanvasEnhancement` and aggregates the results.
 *
 * Aggregation order:
 *  1. Edge transforms are applied in registration order (e.g. conduit styling).
 *  2. Extra nodes / edges are appended after all transforms.
 *  3. `onEdgeClick` handlers are composed (first non-undefined wins).
 */
export function useCanvasEnhancements(
  params: CanvasEnhancementParams,
): CanvasEnhancementsOutput {
  const manifests = NODE_TYPE_REGISTRY.all();

  let currentEdges = params.edges;
  const collectedExtraNodes: Node[] = [];
  const collectedExtraEdges: Edge[] = [];
  let composedOnEdgeClick:
    | ((event: MouseEvent, edge: { id: string }) => void)
    | undefined;

  for (const manifest of manifests) {
    const enhance = manifest.useCanvasEnhancement ?? NOOP_ENHANCEMENT;
    const result = enhance({ ...params, edges: currentEdges });

    if (result.transformedEdges) {
      currentEdges = result.transformedEdges;
    }
    if (result.extraNodes) {
      collectedExtraNodes.push(...result.extraNodes);
    }
    if (result.extraEdges) {
      collectedExtraEdges.push(...result.extraEdges);
    }
    if (result.onEdgeClick && !composedOnEdgeClick) {
      composedOnEdgeClick = result.onEdgeClick;
    }
  }

  const nodes =
    collectedExtraNodes.length > 0
      ? [...params.nodes, ...collectedExtraNodes]
      : params.nodes;

  const edges =
    collectedExtraEdges.length > 0
      ? [...currentEdges, ...collectedExtraEdges]
      : currentEdges;

  return { nodes, edges, onEdgeClick: composedOnEdgeClick };
}
