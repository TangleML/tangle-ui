import type { ComponentReference } from "@/models/componentSpec";
import { Annotations } from "@/models/componentSpec/annotations";
import { Task } from "@/models/componentSpec/entities/task";
import { addTask } from "@/routes/v2/pages/Editor/store/actions";
import { resetAggregatorOnClone } from "@/routes/v2/pages/Editor/store/actions/aggregator.actions";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import {
  isTaskSnapshot,
  snapshotTask,
  taskManifestBase,
} from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";
import { hydrateComponentReference } from "@/services/componentService";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
import type { TaskSpec } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import { LINEAGE_ORIGIN_ANNOTATION } from "@/utils/lineage";

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

      // If the source task has no lineage, generate a fresh UUID origin so that
      // any subsequent copies of the pasted task carry a stable lineage going
      // forward. The PasteLineagePrompt then offers to back-link the source task.
      const hasLineage = snapshot.data.annotations.some(
        (a) => a.key === LINEAGE_ORIGIN_ANNOTATION,
      );
      const extraAnnotations = hasLineage
        ? []
        : [
            {
              key: LINEAGE_ORIGIN_ANNOTATION,
              value: {
                originId:
                  snapshot.data.componentRef.url ??
                  snapshot.data.componentRef.digest ??
                  crypto.randomUUID(),
                originDigest: snapshot.data.componentRef.digest,
                originName: snapshot.data.componentRef.name,
              },
            },
          ];

      const annotations = Annotations.from([
        ...snapshot.data.annotations,
        { key: EDITOR_POSITION_ANNOTATION, value: position },
        ...extraAnnotations,
      ]);

      const clonedComponentRef = deepClone(snapshot.data.componentRef);
      const clonedArguments = deepClone(snapshot.data.arguments);
      const reset = resetAggregatorOnClone(clonedComponentRef, clonedArguments);

      const task = new Task({
        $id: idGen.next("task"),
        name: uniqueName,
        componentRef: reset?.componentRef ?? clonedComponentRef,
        isEnabled: snapshot.data.isEnabled
          ? deepClone(snapshot.data.isEnabled)
          : undefined,
        annotations,
        arguments: reset?.arguments ?? clonedArguments,
        executionOptions: snapshot.data.executionOptions
          ? deepClone(snapshot.data.executionOptions)
          : undefined,
      });

      spec.addTask(task);
      return task.$id;
    },
  },
};
