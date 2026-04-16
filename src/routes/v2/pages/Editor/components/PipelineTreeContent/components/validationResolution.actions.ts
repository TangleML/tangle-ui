import type { ComponentSpec, Task } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

export function deleteEntity(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityType: "task" | "input" | "output" | "binding",
  entityId: string,
) {
  undo.withGroup(`Delete ${entityType}`, () => {
    switch (entityType) {
      case "task":
        spec.removeTaskById(entityId);
        break;
      case "input":
        spec.removeInputById(entityId);
        break;
      case "output":
        spec.removeOutputById(entityId);
        break;
      case "binding":
        spec.removeBindingById(entityId);
        break;
    }
  });
}

export function renameEntity(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityType: "task" | "input" | "output" | "component",
  entityId: string | undefined,
  name: string,
) {
  undo.withGroup(`Rename ${entityType}`, () => {
    if (entityType === "component") {
      spec.setName(name);
    } else if (entityId) {
      if (entityType === "task") {
        const task = spec.tasks.find((t) => t.$id === entityId);
        task?.setName(name);
      } else if (entityType === "input") {
        const input = spec.inputs.find((i) => i.$id === entityId);
        input?.setName(name);
      } else if (entityType === "output") {
        const output = spec.outputs.find((o) => o.$id === entityId);
        output?.setName(name);
      }
    }
  });
}

export function renameDuplicate(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityType: "input" | "output",
  entityId: string,
  name: string,
) {
  undo.withGroup(`Rename duplicate ${entityType}`, () => {
    if (entityType === "input") {
      const input = spec.inputs.find((i) => i.$id === entityId);
      input?.setName(name);
    } else {
      const output = spec.outputs.find((o) => o.$id === entityId);
      output?.setName(name);
    }
  });
}

export function deleteDuplicate(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityType: "input" | "output",
  entityId: string,
) {
  undo.withGroup(`Delete duplicate ${entityType}`, () => {
    if (entityType === "input") {
      spec.removeInputById(entityId);
    } else {
      spec.removeOutputById(entityId);
    }
  });
}

export function unsetBadReference(
  undo: UndoGroupable,
  task: Task,
  spec: ComponentSpec,
  argumentName: string,
) {
  undo.withGroup(`Unset bad reference "${argumentName}"`, () => {
    task.removeArgumentByName(argumentName);
    spec.removeAllBindingsBy(
      (b) => b.targetEntityId === task.$id && b.targetPortName === argumentName,
    );
  });
}
