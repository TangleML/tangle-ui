import type { Node } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  createEntityNode,
  taskDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";
import type { ManifestPartial } from "@/routes/v2/shared/nodes/manifestBases";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";

import { TaskNode } from "./TaskNode";

export const taskManifestBase: ManifestPartial = {
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

  findEntity(spec, entityId) {
    return spec.tasks.find((t) => t.$id === entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "task", position: node.position };
  },

  displayName(spec, entityId) {
    const task = spec.tasks.find((t) => t.$id === entityId);
    return task?.name ?? entityId;
  },

  icon: "Workflow",
  iconColor: "text-blue-500",

  onDoubleClick(spec: ComponentSpec, node: Node, navigation: NavigationStore) {
    const taskData = node.data as TaskNodeData;
    if (navigation.isTaskSubgraph(spec, taskData.entityId)) {
      navigation.navigateToSubgraph(spec, taskData.entityId);
    }
  },
};
