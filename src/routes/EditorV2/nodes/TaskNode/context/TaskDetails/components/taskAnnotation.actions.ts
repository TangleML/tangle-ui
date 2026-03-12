import type { Task } from "@/models/componentSpec";

import { withUndoGroup } from "../../../../../store/undoStore";

export function addAnnotation(task: Task) {
  withUndoGroup("Add annotation", () => {
    task.annotations.add({ key: "", value: "" });
  });
}

export function updateAnnotationKey(task: Task, index: number, key: string) {
  withUndoGroup("Update annotation key", () => {
    task.annotations.updateAt(index, { key });
  });
}

export function updateAnnotationValue(
  task: Task,
  index: number,
  value: string,
) {
  withUndoGroup("Update annotation value", () => {
    task.annotations.updateAt(index, { value });
  });
}

export function removeAnnotation(task: Task, index: number) {
  withUndoGroup("Remove annotation", () => {
    task.annotations.removeAt(index);
  });
}
