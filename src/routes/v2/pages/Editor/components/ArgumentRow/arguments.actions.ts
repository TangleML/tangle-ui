import type { ArgumentType, ComponentSpec, Task } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type { DynamicDataArgument } from "@/utils/componentSpec";

export function setArgument(
  undo: UndoGroupable,
  spec: ComponentSpec,
  taskId: string,
  name: string,
  value: string,
) {
  undo.withGroup(`Set argument "${name}"`, () => {
    spec.setTaskArgument(taskId, name, value);
  });
}

export function unsetArgument(
  undo: UndoGroupable,
  task: Task,
  spec: ComponentSpec,
  name: string,
) {
  undo.withGroup(`Unset argument "${name}"`, () => {
    task.removeArgumentByName(name);
    spec.removeAllBindingsBy(
      (b) => b.targetEntityId === task.$id && b.targetPortName === name,
    );
  });
}

export function removeArgument(undo: UndoGroupable, task: Task, name: string) {
  undo.withGroup(`Remove argument "${name}"`, () => {
    task.removeArgumentByName(name);
  });
}

export function resetArgumentToDefault(
  undo: UndoGroupable,
  spec: ComponentSpec,
  taskId: string,
  name: string,
  defaultValue: string,
) {
  undo.withGroup(`Reset argument "${name}" to default`, () => {
    spec.setTaskArgument(taskId, name, defaultValue);
  });
}

export function setDynamicData(
  undo: UndoGroupable,
  spec: ComponentSpec,
  taskId: string,
  name: string,
  value: DynamicDataArgument,
) {
  undo.withGroup(`Set dynamic data for "${name}"`, () => {
    spec.setTaskArgument(taskId, name, value as unknown as ArgumentType);
  });
}

export function quickConnect(
  undo: UndoGroupable,
  spec: ComponentSpec,
  sourceEntityId: string,
  sourcePortName: string,
  targetEntityId: string,
  targetPortName: string,
) {
  undo.withGroup(`Quick connect to "${targetPortName}"`, () => {
    spec.connectNodes(
      { entityId: sourceEntityId, portName: sourcePortName },
      { entityId: targetEntityId, portName: targetPortName },
    );
  });
}
