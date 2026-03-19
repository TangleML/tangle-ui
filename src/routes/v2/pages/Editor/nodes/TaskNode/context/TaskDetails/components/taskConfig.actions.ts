import type { Task } from "@/models/componentSpec";
import { withUndoGroup } from "@/routes/v2/pages/Editor/store/undoStore";
import type { AnnotationConfig } from "@/types/annotations";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

const TASK_COLOR_ANNOTATION = "tangleml.com/editor/task-color";

export function toggleCacheDisable(task: Task, disabled: boolean) {
  withUndoGroup("Toggle cache disable", () => {
    task.setCacheStaleness(disabled ? ISO8601_DURATION_ZERO_DAYS : undefined);
  });
}

export function saveAnnotation(
  task: Task,
  key: string,
  value: string | undefined,
) {
  withUndoGroup(`Update annotation "${key}"`, () => {
    if (value === undefined || value === "") {
      task.annotations.remove(key);
    } else {
      task.annotations.set(key, value);
    }
  });
}

export function setTaskColor(task: Task, color: string) {
  withUndoGroup("Set task color", () => {
    if (color === "transparent") {
      task.annotations.remove(TASK_COLOR_ANNOTATION);
    } else {
      task.annotations.set(TASK_COLOR_ANNOTATION, color);
    }
  });
}

export function clearProviderAnnotations(
  task: Task,
  annotations: AnnotationConfig[],
) {
  withUndoGroup("Clear provider annotations", () => {
    for (const res of annotations) {
      task.annotations.remove(res.annotation);
    }
  });
}
