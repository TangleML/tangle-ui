import type { Node } from "@xyflow/react";

import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { Annotations } from "@/models/componentSpec/annotations";
import { Task } from "@/models/componentSpec/entities/task";
import { PIPELINE_TREE_WINDOW_ID } from "@/routes/v2/pages/Editor/hooks/usePipelineTreeWindow";
import { addTask } from "@/routes/v2/pages/Editor/store/actions";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import { taskManifestBase } from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import type {
  NodeTypeManifest,
  TaskNodeData,
  TaskNodeSnapshot,
} from "@/routes/v2/shared/nodes/types";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { restoreWindow } from "@/routes/v2/shared/windows/windows.actions";
import { hydrateComponentReference } from "@/services/componentService";
import type { TaskSpec } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";

import { TaskDetails } from "./context/TaskDetails/TaskDetails";

export const taskManifest: NodeTypeManifest = {
  ...taskManifestBase,

  drop: {
    dataKey: "task",
    async handler(spec, data, position, undo) {
      const taskSpec = data as TaskSpec;
      const componentRef = await hydrateComponentReference(
        taskSpec.componentRef,
      );
      if (componentRef) {
        addTask(undo, spec, componentRef as ComponentReference, position);
      }
    },
  },

  updatePosition(_undo, spec, nodeId, position) {
    spec.updateNodePosition(nodeId, position);
  },

  deleteNode(_undo, spec, nodeId) {
    spec.deleteTaskById(nodeId);
  },

  contextPanelComponent: TaskDetails,

  onDoubleClick(spec: ComponentSpec, node: Node, navigation: NavigationStore) {
    const taskData = node.data as TaskNodeData;
    if (navigation.isTaskSubgraph(spec, taskData.entityId)) {
      const newSpec = navigation.navigateToSubgraph(spec, taskData.entityId);
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

    clone(spec, snapshot, idGen, position, _undo) {
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
