import type { Node } from "@xyflow/react";

import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { Annotations } from "@/models/componentSpec/annotations";
import { Task } from "@/models/componentSpec/entities/task";
import { hydrateComponentReference } from "@/services/componentService";
import type { TaskSpec } from "@/utils/componentSpec";

import { PIPELINE_TREE_WINDOW_ID } from "../../hooks/usePipelineTreeWindow";
import { addTask } from "../../store/actions";
import { generateUniqueTaskName } from "../../store/nameUtils";
import {
  isTaskSubgraph,
  navigateToSubgraph,
} from "../../store/navigationStore";
import type { TaskNodeSnapshot } from "../../store/nodeCloneHandlers";
import { restoreWindow } from "../../windows/windows.actions";
import { createEntityNode, taskDefaultPosition } from "../buildUtils";
import type { TaskNodeData } from "../types";
import type { NodeTypeManifest } from "../types";
import { TaskNode } from "./components/TaskNode";
import { TaskDetails } from "./context/TaskDetails/TaskDetails";

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

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
      return `t:${task.$id}:${task.name}:${pos.x},${pos.y}`;
    });
  },

  drop: {
    dataKey: "task",
    async handler(spec, data, position) {
      const taskSpec = data as TaskSpec;
      const componentRef = await hydrateComponentReference(
        taskSpec.componentRef,
      );
      if (componentRef) {
        addTask(spec, componentRef as ComponentReference, position);
      }
    },
  },

  getPosition(spec, nodeId) {
    const task = spec.tasks.find((t) => t.$id === nodeId);
    if (!task) return undefined;
    return task.annotations.get("editor.position");
  },

  updatePosition(spec, nodeId, position) {
    spec.updateNodePosition(nodeId, position);
  },

  deleteNode(spec, nodeId) {
    spec.deleteTaskById(nodeId);
  },

  findEntity(spec, entityId) {
    return spec.tasks.find((t) => t.$id === entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "task", position: node.position };
  },

  contextPanelComponent: TaskDetails,

  displayName(spec, entityId) {
    const task = spec.tasks.find((t) => t.$id === entityId);
    return task?.name ?? entityId;
  },

  icon: "Workflow",
  iconColor: "text-blue-500",

  onDoubleClick(spec: ComponentSpec, node: Node) {
    const taskData = node.data as TaskNodeData;
    if (isTaskSubgraph(spec, taskData.entityId)) {
      const newSpec = navigateToSubgraph(spec, taskData.entityId);
      if (newSpec) {
        restoreWindow(PIPELINE_TREE_WINDOW_ID);
      }
    }
  },

  cloneHandler: {
    snapshot(spec, entityId) {
      const task = spec.tasks.find((t) => t.$id === entityId);
      if (!task) return null;

      const nonEditorAnnotations = task.annotations.items
        .filter((a) => !a.key.startsWith("editor."))
        .map((a) => deepClone(a));

      return {
        entityId: task.$id,
        type: "task",
        name: task.name,
        position: task.annotations.get("editor.position"),
        data: {
          componentRef: deepClone(task.componentRef),
          isEnabled: task.isEnabled ? deepClone(task.isEnabled) : undefined,
          arguments: task.arguments.map((a) => deepClone(a)),
          annotations: nonEditorAnnotations,
        },
      } satisfies TaskNodeSnapshot;
    },

    clone(spec, snapshot, idGen, position) {
      if (snapshot.type !== "task") return null;
      const { data } = snapshot as TaskNodeSnapshot;
      const uniqueName = generateUniqueTaskName(spec, snapshot.name);

      const annotations = Annotations.from([
        ...data.annotations,
        { key: "editor.position", value: position },
      ]);

      const task = new Task({
        $id: idGen.next("task"),
        name: uniqueName,
        componentRef: deepClone(data.componentRef),
        isEnabled: data.isEnabled ? deepClone(data.isEnabled) : undefined,
        annotations,
        arguments: deepClone(data.arguments),
      });

      spec.addTask(task);
      return task.$id;
    },
  },
};
