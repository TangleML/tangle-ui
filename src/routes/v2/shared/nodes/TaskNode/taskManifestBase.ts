import type { Node } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { Task } from "@/models/componentSpec/entities/task";
import type { Annotation } from "@/models/componentSpec/entities/types";
import {
  createEntityNode,
  taskDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";
import type { ManifestPartial } from "@/routes/v2/shared/nodes/manifestBases";
import type {
  NodeSnapshot,
  TaskNodeData,
} from "@/routes/v2/shared/nodes/types";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { deepClone } from "@/utils/deepClone";

import { TaskNode } from "./TaskNode";

// ---------------------------------------------------------------------------
// Task snapshot (shared between Editor and RunView for copy)
// ---------------------------------------------------------------------------

type TaskSnapshotData = Pick<
  Task,
  "componentRef" | "isEnabled" | "arguments"
> & {
  annotations: Annotation[];
};

export function snapshotTask(
  spec: ComponentSpec,
  entityId: string,
): NodeSnapshot<TaskSnapshotData> | null {
  const task = spec.tasks.find((t) => t.$id === entityId);
  if (!task) return null;

  const nonEditorAnnotations = task.annotations.items
    .filter((a) => !a.key.startsWith("editor."))
    .map((a) => deepClone(a));

  return {
    $type: "task",
    entityId: task.$id,
    name: task.name,
    position: task.annotations.get("editor.position"),
    data: {
      componentRef: deepClone(task.componentRef),
      isEnabled: task.isEnabled ? deepClone(task.isEnabled) : undefined,
      arguments: task.arguments.map((a) => deepClone(a)),
      annotations: nonEditorAnnotations,
    },
  };
}

export function isTaskSnapshot(
  snapshot: NodeSnapshot,
): snapshot is NodeSnapshot<TaskSnapshotData> {
  return snapshot.$type === "task";
}

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

  snapshotHandler: { snapshot: snapshotTask },

  onDoubleClick(spec: ComponentSpec, node: Node, navigation: NavigationStore) {
    const taskData = node.data as TaskNodeData;
    if (navigation.isTaskSubgraph(spec, taskData.entityId)) {
      navigation.navigateToSubgraph(spec, taskData.entityId);
    }
  },
};
