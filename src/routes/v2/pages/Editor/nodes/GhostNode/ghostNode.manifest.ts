import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

import { GhostNode } from "./components/GhostNode";
import { useGhostNode } from "./hooks/useGhostNode";

export const ghostManifest: NodeTypeManifest = {
  type: "ghost",
  idPrefix: "ghost_",
  entityType: "ghost",

  component: GhostNode,

  buildNodes() {
    return [];
  },

  getPosition() {
    // Ghost nodes are ephemeral – no position persistence
    return undefined;
  },

  updatePosition() {
    // Ghost nodes are ephemeral – no position persistence
  },

  deleteNode() {
    // Ghost nodes are ephemeral – no deletion logic
  },

  selectable: false,

  useCanvasEnhancement({ spec, metaKeyPressed, isConnecting }) {
    const { ghostNode, ghostEdge } = useGhostNode({
      active: metaKeyPressed,
      isConnecting,
      spec,
    });
    return {
      extraNodes: ghostNode ? [ghostNode] : undefined,
      extraEdges: ghostEdge ? [ghostEdge] : undefined,
    };
  },
};
