import type { ManifestPartial } from "@/routes/v2/shared/nodes/manifestBases";

import { InputClusterNode } from "./InputClusterNode";

/**
 * Aggregated input cluster node. Nodes are not built from the spec directly —
 * membership is derived at render time and injected by the flag-gated
 * `useInputClusters` transform (mirrors the ephemeral GhostNode pattern). The
 * manifest exists so React Flow can render the node type and so drag/autolayout
 * position changes route to the editor manifest's `updatePosition`.
 */
export const inputClusterManifestBase: ManifestPartial = {
  type: "inputCluster",
  idPrefix: "inputcluster_",
  entityType: "inputCluster",

  component: InputClusterNode,

  buildNodes() {
    return [];
  },

  getPosition() {
    return undefined;
  },

  // Not part of editor multi-selection; members are selected via their ports.
  selectable: false,

  icon: "SquareArrowRightEnter",
  iconColor: "text-blue-500",
};
