import type { NodeTypeManifest } from "../types";
import { GhostNode } from "./components/GhostNode";

export const ghostManifest: NodeTypeManifest = {
  type: "ghost",
  idPrefix: "ghost_",
  entityType: "ghost",

  component: GhostNode,

  buildNodes() {
    return [];
  },

  updatePosition() {
    // Ghost nodes are ephemeral – no position persistence
  },

  deleteNode() {
    // Ghost nodes are ephemeral – no deletion logic
  },

  selectable: false,
};
