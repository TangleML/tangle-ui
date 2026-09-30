import type { Edge, Node } from "@xyflow/react";
import type { MouseEvent } from "react";

import type { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import type {
  CanvasEnhancementParams,
  CanvasEnhancementResult,
} from "@/routes/v2/shared/nodes/types";
import type { EdgeOverlayEffect } from "@/routes/v2/shared/store/canvasOverlay.types";
import type { CanvasOverlayStore } from "@/routes/v2/shared/store/canvasOverlayStore";

const NOOP_ENHANCEMENT = (): CanvasEnhancementResult => ({});

function applyEdgeOverlayEffect(edge: Edge, effect: EdgeOverlayEffect): Edge {
  const merged: Edge = { ...edge };
  if (effect.hidden) {
    merged.hidden = true;
  }
  if (effect.opacity !== undefined || effect.style) {
    merged.style = {
      ...edge.style,
      ...effect.style,
      ...(effect.opacity !== undefined ? { opacity: effect.opacity } : {}),
    };
  }
  return merged;
}

function applyOverlayEdgeEffects(
  edges: Edge[],
  overlayStore: CanvasOverlayStore,
): Edge[] {
  const overlay = overlayStore.activeOverlay;
  if (!overlay?.resolveEdgeEffect) return edges;

  return edges.map((edge) => {
    const effect = overlay.resolveEdgeEffect!(edge);
    if (!effect) return edge;
    return applyEdgeOverlayEffect(edge, effect);
  });
}

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
  registry: NodeTypeRegistry,
  params: CanvasEnhancementParams,
  overlayStore: CanvasOverlayStore,
): CanvasEnhancementsOutput {
  const manifests = registry.all();

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

  let edges =
    collectedExtraEdges.length > 0
      ? [...currentEdges, ...collectedExtraEdges]
      : currentEdges;

  edges = applyOverlayEdgeEffects(edges, overlayStore);

  return { nodes, edges, onEdgeClick: composedOnEdgeClick };
}
