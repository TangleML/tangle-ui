import {
  fromSnapshot,
  type SnapshotInOf,
  standaloneAction,
} from "mobx-keystone";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Task } from "@/models/componentSpec/entities/task";
import type {
  ArgumentType,
  DynamicDataArgument,
  GraphInputArgument,
  TaskOutputArgument,
} from "@/utils/componentSpec";

import type { CollabCommand, CollabJsonValue } from "../protocol";
import { isRecord } from "../snapshot";

function isTaskSnapshot(value: unknown): value is SnapshotInOf<Task> {
  return (
    isRecord(value) &&
    value.$modelType === "spec/Task" &&
    typeof value.$id === "string"
  );
}

function isArgumentObject(
  value: unknown,
): value is GraphInputArgument | TaskOutputArgument | DynamicDataArgument {
  return (
    isRecord(value) &&
    ("graphInput" in value || "taskOutput" in value || "dynamicData" in value)
  );
}

function toArgumentType(value: CollabJsonValue): ArgumentType | undefined {
  if (typeof value === "string") return value;
  if (isArgumentObject(value)) return value;
  return undefined;
}

export const applyCommand = standaloneAction(
  "collab/applyCommand",
  (root: ComponentSpec, command: CollabCommand): void => {
    switch (command.type) {
      case "addTask": {
        if (!isTaskSnapshot(command.task)) return;
        root.addTask(fromSnapshot<Task>(command.task));
        return;
      }
      case "deleteTask":
        root.deleteTaskById(command.taskId);
        return;
      case "renameTask":
        root.renameTask(command.taskId, command.name);
        return;
      case "setTaskPosition":
        root.updateNodePosition(command.taskId, command.position);
        return;
      case "setTaskArgument": {
        const value = toArgumentType(command.value);
        if (value === undefined) return;
        root.setTaskArgument(command.taskId, command.portName, value);
        return;
      }
      case "connectNodes": {
        const binding = root.connectNodes(
          {
            entityId: command.source.entityId,
            portName: command.source.portName,
          },
          {
            entityId: command.target.entityId,
            portName: command.target.portName,
          },
        );
        binding.$modelId = command.bindingId;
        return;
      }
      case "deleteEdge":
        root.deleteEdgeById(command.bindingId);
        return;
    }
  },
);
