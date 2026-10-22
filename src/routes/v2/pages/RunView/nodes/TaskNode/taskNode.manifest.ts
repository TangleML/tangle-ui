import { taskManifestBase } from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

import { RunViewTaskDetails } from "./context/RunViewTaskDetails";
import { RunViewTaskNode } from "./RunViewTaskNode";

export const taskManifest: NodeTypeManifest = {
  ...taskManifestBase,

  component: RunViewTaskNode,

  updatePosition(_undo, _spec, _nodeId, _position) {},
  deleteNode(_undo, _spec, _nodeId) {},

  contextPanelComponent: RunViewTaskDetails,
};
