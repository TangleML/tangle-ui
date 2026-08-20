import type { ComponentSpec, Task } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type { AnnotationConfig } from "@/types/annotations";
import {
  EDITOR_COLLAPSED_ANNOTATION,
  TASK_COLOR_ANNOTATION,
} from "@/utils/annotations";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

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

export function setCollapsed(
  undo: UndoGroupable,
  task: Task,
  collapsed: boolean,
) {
  undo.withGroup("Toggle collapse node", () => {
    if (collapsed) {
      task.annotations.set(EDITOR_COLLAPSED_ANNOTATION, "true");
    } else {
      task.annotations.remove(EDITOR_COLLAPSED_ANNOTATION);
    }
  });
}

export function setTaskConditional(
  undo: UndoGroupable,
  spec: ComponentSpec,
  task: Task,
  conditional: boolean,
) {
  undo.withGroup("Toggle conditional task", () => {
    if (conditional) {
      task.setIsEnabled("true");
      return;
    }

    spec.removeAllBindingsBy(
      (b) =>
        b.targetEntityId === task.$id &&
        b.targetPortName === IS_ENABLED_PORT_NAME,
    );
    task.setIsEnabled(undefined);
  });
}

export function setTaskCondition(
  undo: UndoGroupable,
  task: Task,
  enabled: boolean,
) {
  undo.withGroup("Set task condition", () => {
    task.setIsEnabled(enabled ? "true" : "false");
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
