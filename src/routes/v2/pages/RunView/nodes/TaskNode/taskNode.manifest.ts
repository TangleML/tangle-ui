import type { Node } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { taskManifestBase } from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import type {
  NodeTypeManifest,
  TaskNodeData,
} from "@/routes/v2/shared/nodes/types";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";

import { RunViewTaskDetails } from "./context/RunViewTaskDetails";
import { RunViewTaskNode } from "./RunViewTaskNode";

export const taskManifest: NodeTypeManifest = {
  ...taskManifestBase,

  component: RunViewTaskNode,

  updatePosition(_undo, _spec, _nodeId, _position) {},
  deleteNode(_undo, _spec, _nodeId) {},

  contextPanelComponent: RunViewTaskDetails,

  onDoubleClick(
    spec: ComponentSpec,
    node: Node,
    navigation: NavigationStore,
    _windows,
  ) {
    const taskData = node.data as TaskNodeData;
    if (navigation.isTaskSubgraph(spec, taskData.entityId)) {
      navigation.navigateToSubgraph(spec, taskData.entityId);
    }
  },
};
