import type { Task } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type { AnnotationConfig } from "@/types/annotations";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

const TASK_COLOR_ANNOTATION = "tangleml.com/editor/task-color";

export function toggleCacheDisable(
  undo: UndoGroupable,
  task: Task,
  disabled: boolean,
) {
  undo.withGroup("Toggle cache disable", () => {
    task.setCacheStaleness(disabled ? ISO8601_DURATION_ZERO_DAYS : undefined);
  });
}

export function saveAnnotation(
  undo: UndoGroupable,
  task: Task,
  key: string,
  value: string | undefined,
) {
  undo.withGroup(`Update annotation "${key}"`, () => {
    if (value === undefined || value === "") {
      task.annotations.remove(key);
    } else {
      task.annotations.set(key, value);
    }
  });
}

export function setTaskColor(undo: UndoGroupable, task: Task, color: string) {
  undo.withGroup("Set task color", () => {
    if (color === "transparent") {
      task.annotations.remove(TASK_COLOR_ANNOTATION);
    } else {
      task.annotations.set(TASK_COLOR_ANNOTATION, color);
    }
  });
}

export function clearProviderAnnotations(
  undo: UndoGroupable,
  task: Task,
  annotations: AnnotationConfig[],
) {
  undo.withGroup("Clear provider annotations", () => {
    for (const res of annotations) {
      task.annotations.remove(res.annotation);
    }
  });
}
