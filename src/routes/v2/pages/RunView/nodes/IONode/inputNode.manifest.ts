import { inputManifestBase } from "@/routes/v2/shared/nodes/IONode/inputManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

import { RunViewInputDetails } from "./context/RunViewInputDetails";

export const inputManifest: NodeTypeManifest = {
  ...inputManifestBase,

  updatePosition(_undo, _spec, _nodeId, _position) {},
  deleteNode(_undo, _spec, _nodeId) {},

  contextPanelComponent: RunViewInputDetails,
};
