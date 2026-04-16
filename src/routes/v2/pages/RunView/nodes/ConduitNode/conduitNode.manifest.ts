import {
  augmentEdgesWithGuidelines,
  buildConduitNode,
  getConduitPosition,
  getConduits,
} from "@/routes/v2/shared/nodes/ConduitNode/conduit.utils";
import { ConduitNode } from "@/routes/v2/shared/nodes/ConduitNode/ConduitNode";
import { ConduitEdge } from "@/routes/v2/shared/nodes/ConduitNode/edges/ConduitEdge";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

export const conduitManifest: NodeTypeManifest = {
  type: "conduit",
  idPrefix: "conduit_",
  entityType: "conduit",

  component: ConduitNode,
  edgeTypes: { conduitEdge: ConduitEdge },

  buildNodes(spec) {
    return getConduits(spec).map((conduit) => buildConduitNode(conduit, false));
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

  updatePosition(_undo, _spec, _nodeId, _position) {},
  deleteNode(_undo, _spec, _nodeId) {},

  selectable: false,
};
