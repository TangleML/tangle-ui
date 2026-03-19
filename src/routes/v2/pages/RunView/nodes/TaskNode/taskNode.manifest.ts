import type { Node } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { TaskNode } from "@/routes/v2/pages/Editor/nodes/TaskNode/components/TaskNode";
import { RunViewTaskDetails } from "@/routes/v2/pages/RunView/components/RunViewTaskDetails";
import {
  createEntityNode,
  taskDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";
import type {
  NodeTypeManifest,
  TaskNodeData,
} from "@/routes/v2/shared/nodes/types";
import {
  isTaskSubgraph,
  navigateToSubgraph,
} from "@/routes/v2/shared/store/navigationStore";

export const taskManifest: NodeTypeManifest = {
  type: "task",
  idPrefix: "task_",
  entityType: "task",

  component: TaskNode,

  buildNodes(spec) {
    return [...spec.tasks].map((task, index) =>
      createEntityNode(task, "task", taskDefaultPosition(index), {
        entityId: task.$id,
        name: task.name,
      } satisfies TaskNodeData),
    );
  },

  fingerprintParts(spec) {
    return [...spec.tasks].map((task) => {
      const pos = task.annotations.get("editor.position");
      const z = task.annotations.get("zIndex");
      return `t:${task.$id}:${task.name}:${pos.x},${pos.y}:z${z ?? ""}`;
    });
  },

  getPosition(spec, nodeId) {
    const task = spec.tasks.find((t) => t.$id === nodeId);
    if (!task) return undefined;
    return task.annotations.get("editor.position");
  },

  updatePosition() {},
  deleteNode() {},

  findEntity(spec, entityId) {
    return spec.tasks.find((t) => t.$id === entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "task", position: node.position };
  },

  contextPanelComponent: RunViewTaskDetails,

  displayName(spec, entityId) {
    const task = spec.tasks.find((t) => t.$id === entityId);
    return task?.name ?? entityId;
  },

  icon: "Workflow",
  iconColor: "text-blue-500",

  onDoubleClick(spec: ComponentSpec, node: Node) {
    const taskData = node.data as TaskNodeData;
    if (isTaskSubgraph(spec, taskData.entityId)) {
      navigateToSubgraph(spec, taskData.entityId);
    }
  },
};
