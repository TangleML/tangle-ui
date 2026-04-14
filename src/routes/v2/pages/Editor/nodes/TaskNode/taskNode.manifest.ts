import type { ComponentReference } from "@/models/componentSpec";
import { Annotations } from "@/models/componentSpec/annotations";
import { Task } from "@/models/componentSpec/entities/task";
import { addTask } from "@/routes/v2/pages/Editor/store/actions";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import {
  isTaskSnapshot,
  snapshotTask,
  taskManifestBase,
} from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";
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

  cloneHandler: {
    snapshot: snapshotTask,

    clone(spec, snapshot, idGen, position, _undo) {
      if (!isTaskSnapshot(snapshot)) return null;

      const uniqueName = generateUniqueTaskName(spec, snapshot.name);
      const annotations = Annotations.from([
        ...snapshot.data.annotations,
        { key: "editor.position", value: position },
      ]);

      const task = new Task({
        $id: idGen.next("task"),
        name: uniqueName,
        componentRef: deepClone(snapshot.data.componentRef),
        isEnabled: snapshot.data.isEnabled
          ? deepClone(snapshot.data.isEnabled)
          : undefined,
        annotations,
        arguments: deepClone(snapshot.data.arguments),
      });

      spec.addTask(task);
      return task.$id;
    },
  },
};
