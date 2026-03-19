import type { Edge, Node, XYPosition } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { EdgeConduit } from "@/models/componentSpec/annotations";
import type {
  ConduitEdgeData,
  ConduitNodeData,
  GuidelineInfo,
} from "@/routes/v2/shared/nodes/types";

import { buildEntityPositionMap } from "./build.utils";

export function getConduits(spec: ComponentSpec): EdgeConduit[] {
  return spec.annotations.get("tangleml.com/editor/edge-conduits");
}

const GUIDELINE_EXTENT = 100000;
const GUIDELINE_HALF_EXTENT = GUIDELINE_EXTENT / 2;
const GUIDELINE_THICKNESS = 4;

/**
 * Build a lookup: bindingId -> ordered list of guidelines for that edge.
 * Guidelines are ordered by proximity from source position.
 */
function buildEdgeConduitMap(
  conduits: EdgeConduit[],
  getSourcePosition: (bindingId: string) => XYPosition | undefined,
): Map<string, EdgeConduit[]> {
  const map = new Map<string, EdgeConduit[]>();

  for (const conduit of conduits) {
    for (const edgeId of conduit.edgeIds) {
      const list = map.get(edgeId);
      if (list) {
        list.push(conduit);
      } else {
        map.set(edgeId, [conduit]);
      }
    }
  }

  for (const [bindingId, conds] of map) {
    if (conds.length <= 1) continue;
    const srcPos = getSourcePosition(bindingId);
    if (!srcPos) continue;

    conds.sort((a, b) => {
      const distA =
        a.orientation === "vertical"
          ? (a.coordinate - srcPos.x) ** 2
          : (a.coordinate - srcPos.y) ** 2;
      const distB =
        b.orientation === "vertical"
          ? (b.coordinate - srcPos.x) ** 2
          : (b.coordinate - srcPos.y) ** 2;
      return distA - distB;
    });
  }

  return map;
}

/**
 * For each guideline, build a map: guidelineId -> { total edges, per-edge index }.
 */
function buildPerGuidelineEdgeIndices(
  edgeConduitMap: Map<string, EdgeConduit[]>,
): Map<string, Map<string, number>> {
  const guidelineEdgeIndex = new Map<string, Map<string, number>>();

  for (const [bindingId, conduits] of edgeConduitMap) {
    for (const conduit of conduits) {
      let indexMap = guidelineEdgeIndex.get(conduit.id);
      if (!indexMap) {
        indexMap = new Map();
        guidelineEdgeIndex.set(conduit.id, indexMap);
      }
      if (!indexMap.has(bindingId)) {
        indexMap.set(bindingId, indexMap.size);
      }
    }
  }

  return guidelineEdgeIndex;
}

export function augmentEdgesWithGuidelines(
  spec: ComponentSpec,
  edges: Edge[],
  conduits: EdgeConduit[],
): Edge[] {
  const entityPositions = buildEntityPositionMap(
    [...spec.inputs],
    [...spec.outputs],
    [...spec.tasks],
  );

  const edgeConduitMap = buildEdgeConduitMap(conduits, (bindingId) => {
    const binding = [...spec.bindings].find((b) => b.$id === bindingId);
    if (!binding) return undefined;
    return entityPositions.get(binding.sourceEntityId);
  });

  const perGuidelineIndices = buildPerGuidelineEdgeIndices(edgeConduitMap);

  return edges.map((edge) => {
    const bindingId = edge.id.replace(/^edge_/, "");
    const assignedConduits = edgeConduitMap.get(bindingId);

    if (!assignedConduits || assignedConduits.length === 0) return edge;

    const guidelines: GuidelineInfo[] = assignedConduits.map((conduit) => {
      const indexMap = perGuidelineIndices.get(conduit.id);
      const edgeIndex = indexMap?.get(bindingId) ?? 0;
      const edgeTotal = indexMap?.size ?? 1;

      return {
        orientation: conduit.orientation,
        coordinate: conduit.coordinate,
        edgeIndex,
        edgeTotal,
      };
    });

    return {
      ...edge,
      type: "conduitEdge",
      data: {
        guidelines,
        conduitColor: assignedConduits[0].color,
      } satisfies ConduitEdgeData,
    };
  });
}

export function buildConduitNode(
  conduit: EdgeConduit,
  draggable: boolean,
): Node {
  const isVertical = conduit.orientation === "vertical";
  return {
    id: conduit.id,
    type: "conduit",
    position: isVertical
      ? { x: conduit.coordinate, y: -GUIDELINE_HALF_EXTENT }
      : { x: -GUIDELINE_HALF_EXTENT, y: conduit.coordinate },
    width: isVertical ? GUIDELINE_THICKNESS : GUIDELINE_EXTENT,
    height: isVertical ? GUIDELINE_EXTENT : GUIDELINE_THICKNESS,
    data: {
      conduitId: conduit.id,
      color: conduit.color,
      edgeCount: conduit.edgeIds.length,
      orientation: conduit.orientation,
      coordinate: conduit.coordinate,
    } satisfies ConduitNodeData,
    draggable,
    selectable: false,
    connectable: false,
  };
}

export function getConduitPosition(conduit: EdgeConduit) {
  return conduit.orientation === "vertical"
    ? { x: conduit.coordinate, y: -GUIDELINE_HALF_EXTENT }
    : { x: -GUIDELINE_HALF_EXTENT, y: conduit.coordinate };
}

export function buildConduitFingerprint(conduit: EdgeConduit): string {
  return `g:${conduit.id}:${conduit.orientation}:${conduit.coordinate}:${conduit.color}:${conduit.edgeIds.join(",")}`;
}
