import { inputClusterManifestBase } from "@/routes/v2/shared/nodes/InputClusterNode/inputClusterManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

import {
  removeInputClusterPosition,
  setInputClusterPosition,
} from "./inputCluster.actions";

export const inputClusterManifest: NodeTypeManifest = {
  ...inputClusterManifestBase,

  updatePosition(undo, spec, nodeId, position) {
    setInputClusterPosition(undo, spec, nodeId, position);
  },

  deleteNode(undo, spec, nodeId) {
    // Membership is derived; "deleting" only drops the persisted position so the
    // cluster falls back to its computed centroid.
    removeInputClusterPosition(undo, spec, nodeId);
  },
};
