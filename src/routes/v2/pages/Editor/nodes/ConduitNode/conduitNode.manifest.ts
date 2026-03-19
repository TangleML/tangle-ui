import type { Edge, Node, XYPosition } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import type {
  EdgeConduit,
  GuidelineOrientation,
} from "@/models/componentSpec/annotations";
import { buildEntityPositionMap } from "@/routes/v2/shared/nodes/buildUtils";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";
import { SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { selectNode } from "@/routes/v2/shared/store/editorStore";
import { keyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { ConduitNode, type ConduitNodeData } from "./components/ConduitNode";
import {
  addGuideline,
  getConduits,
  removeConduit,
  updateGuidelineCoordinate,
} from "./conduits.actions";
import { ConduitDetails } from "./context/ConduitDetails";
import { ConduitEdge, type ConduitEdgeData } from "./edges/ConduitEdge";
import type { GuidelineInfo } from "./edges/conduitPathUtils";
import { useConduitEdgeMode } from "./hooks/useConduitEdgeMode";

const GUIDELINE_EXTENT = 100000;
const GUIDELINE_HALF_EXTENT = GUIDELINE_EXTENT / 2;
const GUIDELINE_THICKNESS = 4;

export const conduitManifest: NodeTypeManifest = {
  type: "conduit",
  idPrefix: "conduit_",
  entityType: "conduit",

  component: ConduitNode,
  edgeTypes: { conduitEdge: ConduitEdge },

  buildNodes(spec) {
    return getConduits(spec).map((conduit): Node => {
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
        draggable: true,
        selectable: false,
        connectable: false,
      };
    });
  },

  fingerprintParts(spec) {
    return getConduits(spec).map(
      (conduit) =>
        `g:${conduit.id}:${conduit.orientation}:${conduit.coordinate}:${conduit.color}:${conduit.edgeIds.join(",")}`,
    );
  },

  transformEdges(spec, edges) {
    const conduits = getConduits(spec);
    if (conduits.length === 0) return edges;
    return augmentEdgesWithGuidelines(spec, edges, conduits);
  },

  getPosition(spec, nodeId) {
    const conduit = getConduits(spec).find((c) => c.id === nodeId);
    if (!conduit) return undefined;
    return conduit.orientation === "vertical"
      ? { x: conduit.coordinate, y: -GUIDELINE_HALF_EXTENT }
      : { x: -GUIDELINE_HALF_EXTENT, y: conduit.coordinate };
  },

  updatePosition(spec, nodeId, position) {
    const conduit = getConduits(spec).find((c) => c.id === nodeId);
    if (!conduit) return;

    const coordinate =
      conduit.orientation === "vertical" ? position.x : position.y;
    updateGuidelineCoordinate(spec, nodeId, coordinate);
  },

  deleteNode(spec, nodeId) {
    removeConduit(spec, nodeId);
  },

  selectable: false,

  contextPanelComponent: ConduitDetails,

  onPaneClick(spec, position) {
    const orientation = getGuidelineOrientation();
    if (!orientation) return;

    const coordinate = orientation === "horizontal" ? position.y : position.x;
    const guideline = addGuideline(spec, orientation, coordinate);
    selectNode(guideline.id, "conduit");
    keyboardStore.clearPressed();
  },

  useCanvasEnhancement({ edges, spec }) {
    const { edges: styledEdges, onEdgeClick } = useConduitEdgeMode(edges, spec);
    return {
      transformedEdges: styledEdges,
      onEdgeClick,
    };
  },
};

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

function getGuidelineOrientation(): GuidelineOrientation | null {
  if (!keyboardStore.pressed.has(SHIFT)) return null;
  if (keyboardStore.pressed.has("Q")) return "horizontal";
  if (keyboardStore.pressed.has("W")) return "vertical";
  return null;
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

function augmentEdgesWithGuidelines(
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
    const binding = [...spec.bindings].find(
      (binding) => binding.$id === bindingId,
    );
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
