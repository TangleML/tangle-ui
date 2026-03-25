import type { GuidelineOrientation } from "@/models/componentSpec/annotations";
import {
  augmentEdgesWithGuidelines,
  buildConduitNode,
  getConduitPosition,
} from "@/routes/v2/shared/nodes/ConduitNode/conduit.utils";
import { ConduitNode } from "@/routes/v2/shared/nodes/ConduitNode/ConduitNode";
import { ConduitEdge } from "@/routes/v2/shared/nodes/ConduitNode/edges/ConduitEdge";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";
import { SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import type { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import {
  addGuideline,
  getConduits,
  removeConduit,
  updateGuidelineCoordinate,
} from "./conduits.actions";
import { ConduitDetails } from "./context/ConduitDetails";
import { useConduitEdgeMode } from "./hooks/useConduitEdgeMode";

export const conduitManifest: NodeTypeManifest = {
  type: "conduit",
  idPrefix: "conduit_",
  entityType: "conduit",

  component: ConduitNode,
  edgeTypes: { conduitEdge: ConduitEdge },

  buildNodes(spec) {
    return getConduits(spec).map((conduit) => buildConduitNode(conduit, true));
  },

  transformEdges(spec, edges) {
    const conduits = getConduits(spec);
    if (conduits.length === 0) return edges;
    return augmentEdgesWithGuidelines(spec, edges, conduits);
  },

  getPosition(spec, nodeId) {
    const conduit = getConduits(spec).find((c) => c.id === nodeId);
    if (!conduit) return undefined;
    return getConduitPosition(conduit);
  },

  updatePosition(undo, spec, nodeId, position) {
    const conduit = getConduits(spec).find((c) => c.id === nodeId);
    if (!conduit) return;

    const coordinate =
      conduit.orientation === "vertical" ? position.x : position.y;
    updateGuidelineCoordinate(undo, spec, nodeId, coordinate);
  },

  deleteNode(undo, spec, nodeId) {
    removeConduit(undo, spec, nodeId);
  },

  selectable: false,

  contextPanelComponent: ConduitDetails,

  onPaneClick(spec, position, { editor, keyboard, undo }) {
    const orientation = getGuidelineOrientation(keyboard);
    if (!orientation) return;

    const coordinate = orientation === "horizontal" ? position.y : position.x;
    const guideline = addGuideline(undo, spec, orientation, coordinate);
    editor.selectNode(guideline.id, "conduit");
    keyboard.clearPressed();
  },

  useCanvasEnhancement({ edges, spec }) {
    const { edges: styledEdges, onEdgeClick } = useConduitEdgeMode(edges, spec);
    return {
      transformedEdges: styledEdges,
      onEdgeClick,
    };
  },
};

function getGuidelineOrientation(
  keyboard: KeyboardStore,
): GuidelineOrientation | null {
  if (!keyboard.pressed.has(SHIFT)) return null;
  if (keyboard.pressed.has("Q")) return "horizontal";
  if (keyboard.pressed.has("W")) return "vertical";
  return null;
}
