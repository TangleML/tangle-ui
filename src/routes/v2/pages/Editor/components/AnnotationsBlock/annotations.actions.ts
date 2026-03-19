import type { Annotations } from "@/models/componentSpec/annotations";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

export function addAnnotation(undo: UndoGroupable, annotations: Annotations) {
  undo.withGroup("Add annotation", () => {
    annotations.add({ key: "", value: "" });
  });
}

export function updateAnnotationKey(
  undo: UndoGroupable,
  annotations: Annotations,
  index: number,
  key: string,
) {
  undo.withGroup("Update annotation key", () => {
    annotations.updateAt(index, { key });
  });
}

export function updateAnnotationValue(
  undo: UndoGroupable,
  annotations: Annotations,
  index: number,
  value: string,
) {
  undo.withGroup("Update annotation value", () => {
    annotations.updateAt(index, { value });
  });
}

export function removeAnnotation(
  undo: UndoGroupable,
  annotations: Annotations,
  index: number,
) {
  undo.withGroup("Remove annotation", () => {
    annotations.removeAt(index);
  });
}
