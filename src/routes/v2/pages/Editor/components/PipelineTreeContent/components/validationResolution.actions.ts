import type { ComponentSpec, Task } from "@/models/componentSpec";
import { withUndoGroup } from "@/routes/v2/pages/Editor/store/undoStore";

export function deleteEntity(
  spec: ComponentSpec,
  entityType: "task" | "input" | "output" | "binding",
  entityId: string,
) {
  withUndoGroup(`Delete ${entityType}`, () => {
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
  spec: ComponentSpec,
  entityType: "task" | "input" | "output" | "component",
  entityId: string | undefined,
  name: string,
) {
  withUndoGroup(`Rename ${entityType}`, () => {
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
  spec: ComponentSpec,
  entityType: "input" | "output",
  entityId: string,
  name: string,
) {
  withUndoGroup(`Rename duplicate ${entityType}`, () => {
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
  spec: ComponentSpec,
  entityType: "input" | "output",
  entityId: string,
) {
  withUndoGroup(`Delete duplicate ${entityType}`, () => {
    if (entityType === "input") {
      spec.removeInputById(entityId);
    } else {
      spec.removeOutputById(entityId);
    }
  });
}

export function unsetBadReference(
  task: Task,
  spec: ComponentSpec,
  argumentName: string,
) {
  withUndoGroup(`Unset bad reference "${argumentName}"`, () => {
    task.removeArgumentByName(argumentName);
    spec.removeAllBindingsBy(
      (b) => b.targetEntityId === task.$id && b.targetPortName === argumentName,
    );
  });
}
