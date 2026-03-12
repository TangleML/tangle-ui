import type { ArgumentType, ComponentSpec, Task } from "@/models/componentSpec";
import type { DynamicDataArgument } from "@/utils/componentSpec";

import { withUndoGroup } from "../store/undoStore";

export function setArgument(
  spec: ComponentSpec,
  taskId: string,
  name: string,
  value: string,
) {
  withUndoGroup(`Set argument "${name}"`, () => {
    spec.setTaskArgument(taskId, name, value);
  });
}

export function unsetArgument(task: Task, spec: ComponentSpec, name: string) {
  withUndoGroup(`Unset argument "${name}"`, () => {
    task.removeArgumentByName(name);
    spec.removeAllBindingsBy(
      (b) => b.targetEntityId === task.$id && b.targetPortName === name,
    );
  });
}

export function removeArgument(task: Task, name: string) {
  withUndoGroup(`Remove argument "${name}"`, () => {
    task.removeArgumentByName(name);
  });
}

export function resetArgumentToDefault(
  spec: ComponentSpec,
  taskId: string,
  name: string,
  defaultValue: string,
) {
  withUndoGroup(`Reset argument "${name}" to default`, () => {
    spec.setTaskArgument(taskId, name, defaultValue);
  });
}

export function setDynamicData(
  spec: ComponentSpec,
  taskId: string,
  name: string,
  value: DynamicDataArgument,
) {
  withUndoGroup(`Set dynamic data for "${name}"`, () => {
    spec.setTaskArgument(taskId, name, value as unknown as ArgumentType);
  });
}

export function quickConnect(
  spec: ComponentSpec,
  sourceEntityId: string,
  sourcePortName: string,
  targetEntityId: string,
  targetPortName: string,
) {
  withUndoGroup(`Quick connect to "${targetPortName}"`, () => {
    spec.connectNodes(
      { entityId: sourceEntityId, portName: sourcePortName },
      { entityId: targetEntityId, portName: targetPortName },
    );
  });
}
