import { RunViewTaskDetails } from "@/routes/v2/pages/RunView/components/RunViewTaskDetails";
import { taskManifestBase } from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

export const taskManifest: NodeTypeManifest = {
  ...taskManifestBase,

  updatePosition(_undo, _spec, _nodeId, _position) {},
  deleteNode(_undo, _spec, _nodeId) {},

  contextPanelComponent: RunViewTaskDetails,
};
